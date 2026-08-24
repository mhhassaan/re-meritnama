"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ConsentState } from "@/lib/portal/merit-list";
import { useManualCandidate } from "@/components/portal/add-me-modal";
import {
  simulateNextRound,
  type ConsentOverride,
  type SimulationResult,
} from "@/lib/portal/simulate";

/**
 * Consent editing, and the simulation it feeds.
 *
 * The reader toggles a consent pill on any seat to model a decision — "what if
 * this person declines?" — and then runs the cascade against the whole round
 * with those edits applied. That is the portal's central feature, and the
 * reason the engine exists.
 *
 * State lives in a context rather than the URL, unlike the filters. A set of
 * edits is a working scratchpad, not a view worth linking to, and encoding
 * dozens of them in a query string would make the address bar unreadable and
 * re-render the whole grid on every click.
 *
 * Only CHANGES are held. A pill left as published contributes nothing, so the
 * payload sent to the server is the size of what the reader actually did — not
 * 1,208 rows restating the file.
 */

type Overrides = Map<string, ConsentState>;

type SimulationContextValue = {
  /** The state a pill should render, published value included. */
  stateFor: (applicantId: number, seatKey: string, published: ConsentState) => ConsentState;
  /** Cycles Accepted to Excluded to Awaited, as the original does. */
  cycle: (applicantId: number, seatKey: string, published: ConsentState) => void;
  isEdited: (applicantId: number, seatKey: string) => boolean;
  editCount: number;
  reset: () => void;
  run: () => void | Promise<void>;
  running: boolean;
  result: SimulationResult | null;
  dismiss: () => void;
};

const SimulationContext = createContext<SimulationContextValue | null>(null);

const NEXT: Record<ConsentState, ConsentState> = {
  Accepted: "Excluded",
  Excluded: "Awaited",
  Awaited: "Accepted",
};

export function SimulationProvider({
  round,
  children,
}: {
  round: number;
  children: ReactNode;
}) {
  const [overrides, setOverrides] = useState<Overrides>(new Map());
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);

  // Read fresh on every run rather than captured once: the reader can edit
  // their entry and simulate again without reloading.
  const manual = useManualCandidate();

  // Guards against a second run landing on top of a first. The cascade takes
  // seconds; without this, clicking twice can show the earlier answer last.
  const runId = useRef(0);

  // Edits are keyed by (applicant, seat) within ONE published round, and this
  // provider survives a change of round: filters and paging are same-route
  // navigations, so React keeps the component mounted and its state with it.
  // That is what carries a scratchpad across pages of the same round — and
  // exactly what must not carry across rounds, where the same seat holds
  // different people and an edit would be applied to whoever now sits there.
  const seenRound = useRef(round);
  if (seenRound.current !== round) {
    seenRound.current = round;
    setOverrides(new Map());
    setResult(null);
  }

  const key = (applicantId: number, seatKey: string) => `${applicantId}::${seatKey}`;

  const stateFor = useCallback(
    (applicantId: number, seatKey: string, published: ConsentState) =>
      overrides.get(key(applicantId, seatKey)) ?? published,
    [overrides]
  );

  const isEdited = useCallback(
    (applicantId: number, seatKey: string) => overrides.has(key(applicantId, seatKey)),
    [overrides]
  );

  const cycle = useCallback(
    (applicantId: number, seatKey: string, published: ConsentState) => {
      setOverrides((prev) => {
        const next = new Map(prev);
        const id = key(applicantId, seatKey);
        const current = next.get(id) ?? published;
        const target = NEXT[current];

        // Cycling back to the published value is not an edit — dropping it
        // keeps the count honest and the payload minimal.
        if (target === published) next.delete(id);
        else next.set(id, target);

        return next;
      });
      // A stale change log next to fresh edits invites reading one as the
      // result of the other.
      setResult(null);
    },
    []
  );

  const reset = useCallback(() => {
    setOverrides(new Map());
    setResult(null);
  }, []);

  // A plain awaited handler rather than `useTransition`. Nothing about this
  // update wants to be interruptible or low priority — the reader asked for one
  // answer and waits for it — and an explicit pending flag is easier to reason
  // about than a transition's. The run id guards the case a transition would
  // have handled for free: a second run must not be overwritten by a slower
  // first one.
  const run = useCallback(async () => {
    const payload: ConsentOverride[] = [...overrides.entries()].map(([id, status]) => {
      const [applicantId, seatKey] = id.split("::");
      return { applicantId: Number(applicantId), seatKey, status };
    });

    const id = ++runId.current;
    setRunning(true);

    try {
      const next = await simulateNextRound(round, payload, manual);
      // A superseded run must not overwrite a newer one.
      if (id === runId.current) setResult(next);
    } catch {
      if (id === runId.current) {
        setResult({ ok: false, error: "The simulation could not be completed. Try again." });
      }
    } finally {
      if (id === runId.current) setRunning(false);
    }
  }, [overrides, round, manual]);

  const value = useMemo(
    () => ({
      stateFor,
      cycle,
      isEdited,
      editCount: overrides.size,
      reset,
      run,
      running,
      result,
      dismiss: () => setResult(null),
    }),
    [stateFor, cycle, isEdited, overrides.size, reset, run, running, result]
  );

  return (
    <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>
  );
}

export function useSimulation(): SimulationContextValue {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error("useSimulation must be used inside a SimulationProvider");
  }
  return context;
}
