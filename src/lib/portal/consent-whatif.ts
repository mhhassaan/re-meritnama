import "server-only";

import { CURRENT_INDUCTION } from "@/lib/induction";
import { createClient } from "@/lib/supabase/server";
import { loadPool, loadPreferenceIndex, loadPublishedNames, loadSeatRows } from "./pool-cache";
import { activeScope, inScope } from "./config";
import {
  runPlacement,
  type PlacementApplicant,
  type PlacementResult,
  type PlacementSeat,
  type QuotaTrack,
} from "./placement";

/**
 * Consent What-If.
 *
 * The original's framing: "Compare normal seat allocation with a rerun where
 * one candidate does not consent. The report shows the released seat, who
 * moves in, and the subsequent candidate list changes."
 *
 * ## This is built on the blank-slate placement engine, not the cascade
 *
 * Worth stating plainly, because it is easy to assume otherwise: the original
 * source (`sim-consent.js`, read directly rather than guessed at) calls
 * `runPlacementFromPool`, which is `sim-placement.js`'s deferred-acceptance
 * run — the same algorithm behind Seat Allocation, ported here as
 * `runPlacement`. It is **not** a narrower entry point into the cascade that
 * powers Simulate Next Round. "No consent" here means "remove this applicant
 * from the whole programme's pool and run the blank-slate allocation again
 * from scratch" — every seat is up for grabs a second time, not just the one
 * this candidate held. That is also why the ripple can reach candidates who
 * never listed the released seat at all: a domino of preference-list
 * reshuffling, not a localised vacate-and-refill.
 *
 * ## Two runs, one fetch
 *
 * `loadPool`, `loadSeatRows` and `loadPreferenceIndex` are the same cached
 * inputs `runAllocation` uses. Both the baseline and the no-consent variant
 * are computed from the one fetch — fetching twice would double the 39 MB
 * cost for nothing, since removing one applicant does not change what anyone
 * else's preferences are.
 *
 * ## The diff needs no roster of "who did not change"
 *
 * The original walks every competitor, placed or not, to build a before/after
 * map. That is not necessary here: a candidate who is unplaced in both runs
 * produces no map entry in either `placedByKey` below, so they are silently
 * absent from the diff — which is exactly the outcome a full roster would
 * have produced by comparing `false === false`. Only presence needs
 * comparing, not absence.
 */

export type ConsentMode = "no-consent" | "consent";

export type PlacementRef = {
  track: QuotaTrack;
  program: string;
  specialty: string;
  hospital: string;
  quota: string;
  mark: number;
  preferenceNo: number;
};

export type ReleasedSlot = PlacementRef & {
  incoming: Array<{
    applicantId: number;
    name: string | null;
    mark: number;
    preferenceNo: number;
    track: QuotaTrack;
  }>;
};

export type ChangeKind = "gain" | "move" | "remove";

export type ChangedCandidate = {
  applicantId: number;
  name: string | null;
  isTarget: boolean;
  kind: ChangeKind;
  before: PlacementRef | null;
  after: PlacementRef | null;
};

export type ConsentReport = {
  program: string;
  mode: ConsentMode;
  candidateId: number;
  candidateName: string | null;
  candidateMarks: number | null;
  statusLabel: string;
  baselinePlaced: PlacementRef[];
  variantPlaced: PlacementRef[];
  releasedSlots: ReleasedSlot[];
  changedCandidates: ChangedCandidate[];
  /** True count, before the display cap. */
  changedCandidateCount: number;
  baselinePlacedCount: number;
  variantPlacedCount: number;
  poolSize: number;
};

export type ConsentWhatIfResult =
  | { ok: true; report: ConsentReport }
  | {
      ok: false;
      reason: "unverified" | "not-found" | "not-in-program" | "outside-scope";
    };

/**
 * How many changed-candidate rows reach the caller.
 *
 * A blank-slate re-run can genuinely displace hundreds of people, unlike the
 * cascade's localised ripple, so — unlike the Competition table, whose ~160
 * rows were cheap enough to stop capping — this stays truncated. The true
 * count is always returned alongside it.
 */
const CHANGED_CAP = 60;

const t = (v: string | null | undefined) => (v ?? "").trim();
const seatKeyOf = (program: string, specialty: string, hospital: string, quota: string) =>
  `${t(program)}|${t(specialty)}|${t(hospital)}|${t(quota)}`;
const recordKey = (applicantId: number, track: QuotaTrack) => `${applicantId}::${track}`;

/** Every placed candidate in a run, keyed by (applicant, track). */
function placedByKey(
  result: PlacementResult
): Map<string, PlacementRef & { applicantId: number }> {
  const out = new Map<string, PlacementRef & { applicantId: number }>();
  for (const slot of result.slots) {
    for (const person of slot.placed) {
      out.set(recordKey(person.applicantId, person.track), {
        applicantId: person.applicantId,
        track: person.track,
        program: result.program,
        specialty: slot.specialty,
        hospital: slot.hospital,
        quota: slot.quota,
        mark: person.mark,
        preferenceNo: person.preferenceNo,
      });
    }
  }
  return out;
}

/** Structural, so it accepts a `PlacementRef` or a `SlotResult` alike. */
type SeatIdentity = { specialty: string; hospital: string; quota: string };
const sameSeat = (a: SeatIdentity, b: SeatIdentity) =>
  a.specialty === b.specialty && a.hospital === b.hospital && a.quota === b.quota;

export async function runConsentWhatIf(
  program: string,
  candidateId: number,
  mode: ConsentMode,
  induction: number = CURRENT_INDUCTION
): Promise<ConsentWhatIfResult> {
  // Gate reused, not restated — the same check `simulate.ts` and
  // `allocation-action.ts` use.
  const supabase = await createClient();
  const { data: gate } = await supabase
    .from("seats")
    .select("id")
    .eq("induction", induction)
    .limit(1);
  if (!gate?.length) return { ok: false, reason: "unverified" };

  const [seatRows, pool, index, names, scope] = await Promise.all([
    loadSeatRows(induction),
    loadPool(induction),
    loadPreferenceIndex(induction),
    loadPublishedNames(induction),
    activeScope(),
  ]);

  const seats: PlacementSeat[] = seatRows;

  const targetRow = pool.find((row) => row.applicant_id === candidateId);
  if (!targetRow) return { ok: false, reason: "not-found" };

  const appliedToProgram = (targetRow.preferences ?? []).some(
    (p) => t(p.program) === t(program)
  );
  if (!appliedToProgram) return { ok: false, reason: "not-in-program" };

  if (!inScope(scope, targetRow.profile_status ?? null)) {
    return { ok: false, reason: "outside-scope" };
  }

  const effectiveMark = (applicantId: number, key: string) =>
    index.effectiveMark.get(`${applicantId}::${key}`) ?? index.baseMark.get(applicantId) ?? 0;

  const scopedCandidates: PlacementApplicant[] = pool
    .filter((row) => inScope(scope, row.profile_status ?? null))
    .map((row) => ({
      applicantId: row.applicant_id,
      nameFull: names.get(row.applicant_id) ?? "",
      preferences: row.preferences ?? [],
    }));

  const baseline = runPlacement({ program, seats, candidates: scopedCandidates, effectiveMark });

  // "Consent" is the confirmatory case: the same run, so the diff is
  // definitionally empty. Skipping the second `runPlacement` call rather than
  // computing an identical result and diffing it against itself.
  const variant =
    mode === "no-consent"
      ? runPlacement({
          program,
          seats,
          candidates: scopedCandidates.filter((c) => c.applicantId !== candidateId),
          effectiveMark,
        })
      : baseline;

  const baselineMap = placedByKey(baseline);
  const variantMap = mode === "no-consent" ? placedByKey(variant) : baselineMap;

  const baselinePlaced = (["civilian", "armed"] as const)
    .map((track) => baselineMap.get(recordKey(candidateId, track)))
    .filter((r): r is PlacementRef & { applicantId: number } => r != null);
  const variantPlaced = (["civilian", "armed"] as const)
    .map((track) => variantMap.get(recordKey(candidateId, track)))
    .filter((r): r is PlacementRef & { applicantId: number } => r != null);

  // ── Released seats and who moves in ──────────────────────────────────────
  const releasedSlots: ReleasedSlot[] = [];
  if (mode === "no-consent") {
    for (const released of baselinePlaced) {
      const baselineSlot = baseline.slots.find((s) => sameSeat(s, released));
      const variantSlot = variant.slots.find((s) => sameSeat(s, released));
      const before = new Set(
        (baselineSlot?.placed ?? []).map((p) => recordKey(p.applicantId, p.track))
      );
      const incoming = (variantSlot?.placed ?? [])
        .filter((p) => !before.has(recordKey(p.applicantId, p.track)))
        .map((p) => ({
          applicantId: p.applicantId,
          name: names.get(p.applicantId) ?? null,
          mark: p.mark,
          preferenceNo: p.preferenceNo,
          track: p.track,
        }));
      releasedSlots.push({ ...released, incoming });
    }
  }

  // ── Every candidate whose placement changed ──────────────────────────────
  const changedCandidates: ChangedCandidate[] = [];
  if (mode === "no-consent") {
    const allKeys = new Set([...baselineMap.keys(), ...variantMap.keys()]);
    for (const key of allKeys) {
      const before = baselineMap.get(key) ?? null;
      const after = variantMap.get(key) ?? null;
      if (before && after && sameSeat(before, after)) continue; // unchanged

      const applicantId = (before ?? after)!.applicantId;
      const kind: ChangeKind = !before ? "gain" : !after ? "remove" : "move";

      changedCandidates.push({
        applicantId,
        name: names.get(applicantId) ?? null,
        isTarget: applicantId === candidateId,
        kind,
        before,
        after,
      });
    }

    // The target's own row first — it is the one the reader asked about —
    // then everyone else by name, so a long list is at least scannable.
    changedCandidates.sort(
      (a, b) =>
        Number(b.isTarget) - Number(a.isTarget) ||
        (a.name ?? "").localeCompare(b.name ?? "") ||
        a.applicantId - b.applicantId
    );
  }

  return {
    ok: true,
    report: {
      program,
      mode,
      candidateId,
      candidateName: names.get(candidateId) ?? null,
      candidateMarks: targetRow.marks_total != null ? Number(targetRow.marks_total) : null,
      statusLabel: scope.label,
      baselinePlaced,
      variantPlaced,
      releasedSlots,
      changedCandidates: changedCandidates.slice(0, CHANGED_CAP),
      changedCandidateCount: changedCandidates.length,
      baselinePlacedCount: baseline.stats.placed,
      variantPlacedCount: variant.stats.placed,
      poolSize: scopedCandidates.length,
    },
  };
}
