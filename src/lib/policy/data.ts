import "server-only";

import { CURRENT_INDUCTION } from "@/lib/induction";
import { loadCycleSummaries, loadPolicies } from "@/lib/merit/data";
import type { PolicyComponent } from "@/lib/calculator/types";

/**
 * Scoring Policy History.
 *
 * The original's framing: "How the PRP merit formula evolved across induction
 * cycles — and why normalization is essential for meaningful cross-year
 * analysis."
 *
 * ## No new data source
 *
 * `policy_by_induction.json` already holds every cycle's components, totals
 * and notes, and `loadPolicies()` already reads and caches it — the merit
 * table, the calculator and the cycle cards all run off it. This page is a
 * presentation of data three other surfaces already share.
 *
 * ## Keyed by induction, not by year
 *
 * The original's own Policy tab reads `scoring_policy.json`, which is keyed by
 * **year** and consequently carries a key literally named `"2026-1"` — because
 * 2026 ran two inductions (20 and 21) with genuinely different formulas, and a
 * year-keyed object cannot hold both. We use the induction-keyed file instead,
 * which is the same choice the rest of this app already made and the reason
 * `labelWithInduction` exists. Two cycles in one year are two rows here, each
 * named for its induction.
 */

export type PolicyCycle = {
  induction: number;
  year: number;
  /** Year plus induction, e.g. "2026 (Ind 21)". Never assembled in a component. */
  label: string;
  totalMarks: number;
  notes: string | null;
  policyRef: string | null;
  tidbits: string[];
  /** Carrying marks this cycle. */
  included: PolicyComponent[];
  /** Present in the record but worth zero — kept so the removal is visible. */
  removed: PolicyComponent[];
  isCurrent: boolean;
};

/**
 * What a component was doing in a given cycle.
 *
 * The distinction between `pending` and `dropped` cannot be read off a single
 * cycle's record, and getting it wrong inverts the meaning. See
 * `stateFor` below.
 */
export type ComponentState = "active" | "dropped" | "pending";

export type ComponentRow = {
  key: string;
  label: string;
  /** Marks per induction. Zero where the component carried none. */
  byInduction: Record<number, number>;
  state: Record<number, ComponentState>;
};

export type PolicyHistory = {
  cycles: PolicyCycle[];
  /** One row per component that carried marks in at least one held cycle. */
  components: ComponentRow[];
  /**
   * Components in the policy record that never carried marks in any cycle we
   * hold — `attempts_in_mbbs` is the only one today.
   *
   * Excluded from the matrix, where they would be a row of dashes saying
   * nothing, but named underneath it rather than dropped silently: the
   * calculator lists them under "no longer counted", so a reader who saw one
   * there and not here would reasonably wonder which page was wrong.
   */
  neverUsed: string[];
};

type RawPolicy = {
  induction_id?: number;
  year?: number;
  label?: string;
  policy_ref?: string;
  total_marks?: number;
  notes?: string;
  tidbits?: string[];
  components?: PolicyComponent[];
};

export async function loadPolicyHistory(): Promise<PolicyHistory> {
  const [policies, summaries] = await Promise.all([
    loadPolicies(),
    loadCycleSummaries(),
  ]);

  // `labelWithInduction` is built in `loadCycleSummaries` and nowhere else —
  // AGENTS.md makes that a standing rule, because two cycles can share a year
  // and a bare year label would render them identically.
  const labels = new Map(summaries.map((c) => [c.induction, c.labelWithInduction]));

  const cycles: PolicyCycle[] = Object.entries(
    policies as unknown as Record<string, RawPolicy>
  )
    .map(([key, raw]) => {
      const induction = raw.induction_id ?? Number(key);
      const components = raw.components ?? [];
      return {
        induction,
        year: raw.year ?? 0,
        label: labels.get(induction) ?? raw.label ?? `Ind ${induction}`,
        totalMarks: raw.total_marks ?? 0,
        notes: raw.notes ?? null,
        policyRef: raw.policy_ref ?? null,
        tidbits: raw.tidbits ?? [],
        included: components.filter((c) => c.included !== false),
        removed: components.filter((c) => c.included === false),
        isCurrent: induction === CURRENT_INDUCTION,
      };
    })
    // Newest first. A policy page is read to answer "what changed most
    // recently", not to walk forward from 2020.
    .sort((a, b) => b.induction - a.induction);

  // ── The comparison matrix ───────────────────────────────────────────────
  //
  // Column order follows `cycles`, so the matrix reads newest-to-oldest like
  // the timeline beneath it rather than disagreeing with it.
  const order: string[] = [];
  const labelFor = new Map<string, string>();
  for (const cycle of cycles) {
    for (const component of [...cycle.included, ...cycle.removed]) {
      if (!labelFor.has(component.key)) {
        labelFor.set(component.key, component.label);
        order.push(component.key);
      }
    }
  }

  // Ascending, so "before it was ever introduced" is a comparison rather than
  // a search.
  const ascending = [...cycles].sort((a, b) => a.induction - b.induction);

  const components: ComponentRow[] = order.map((key) => {
    const byInduction: Record<number, number> = {};
    const state: Record<number, ComponentState> = {};

    for (const cycle of cycles) {
      const found = [...cycle.included, ...cycle.removed].find((c) => c.key === key);
      byInduction[cycle.induction] =
        found && found.included !== false ? found.max_marks : 0;
    }

    // **The file cannot tell these two apart on its own.** Every cycle lists
    // all twelve components, with `included: false` and zero marks for the
    // ones not in force — so a component that had not been invented yet looks
    // exactly like one that was taken away. MDCAT is the case that exposes it:
    // introduced in Induction 20, it appears as `included: false` all the way
    // back to Induction 8, and labelling that "dropped" says the opposite of
    // what happened.
    //
    // The timeline resolves it. Anything before a component's first
    // marks-carrying cycle is "pending"; anything at or after it is either
    // still active or genuinely dropped.
    const firstActive = ascending.find((c) => byInduction[c.induction] > 0)?.induction;

    for (const cycle of cycles) {
      state[cycle.induction] =
        byInduction[cycle.induction] > 0
          ? "active"
          : firstActive == null || cycle.induction < firstActive
            ? "pending"
            : "dropped";
    }

    return { key, label: labelFor.get(key)!, byInduction, state };
  });

  const neverUsed = components
    .filter((row) => cycles.every((c) => row.state[c.induction] === "pending"))
    .map((row) => row.label);

  return {
    cycles,
    components: components.filter(
      (row) => !cycles.every((c) => row.state[c.induction] === "pending")
    ),
    neverUsed,
  };
}
