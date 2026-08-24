import "server-only";

import { CURRENT_INDUCTION } from "@/lib/induction";
import {
  loadPool,
  loadPreferenceIndex,
  loadPublishedNames,
  loadSeatRows,
} from "./pool-cache";
import { activeScope, inScope } from "./config";
import { MANUAL_ID_BASE, type ManualCandidate } from "./manual-candidate";
import {
  runPlacement,
  type PlacementApplicant,
  type PlacementPreference,
  type PlacementResult,
  type PlacementSeat,
  type SlotResult,
} from "./placement";

/**
 * Server-side data for the Induction Portal.
 *
 * ## Where the service role is used, and why that is not a shortcut
 *
 * Seats are read **as the signed-in user**: they carry no personal data and RLS
 * lets any verified user read them. Nothing here bypasses that.
 *
 * The allocation pool is different. Modelling competition honestly means
 * reading all 3,474 applicants' preferences, and no user may read another's.
 * There is no policy that would make that legitimate — the pool is read with
 * the service role, deliberately.
 *
 * What makes that safe is not this file being careful. It is that
 * `public.applicants` **cannot** identify anyone: it has no name, no CNIC, no
 * email, no phone, no father's name. Bypassing RLS on it exposes "applicant
 * 12345 applied for these seats and scored this much" and nothing more.
 * `test:rls` asserts that neither client role can read the table at all, and
 * the schema comment records why the column list must stay as it is.
 *
 * Names for display come from `merit_entries`, read as the user, under the
 * policy that already governs it. Anyone who never placed has no published
 * name, so they appear as an applicant id — which is the honest rendering, not
 * a gap to be filled.
 */

export type PortalSeat = PlacementSeat & { institute: string | null };

/** Seats for a cycle, read as the caller. RLS decides; nothing here filters. */
export async function loadSeats(
  induction: number = CURRENT_INDUCTION
): Promise<PortalSeat[]> {
  return loadSeatRows(induction);
}

export type AllocationSlot = SlotResult & {
  /** Published names where they exist; ids otherwise. */
  placedNames: Array<{ applicantId: number; name: string | null; mark: number; preferenceNo: number }>;
};

export type Allocation = {
  program: string;
  programs: string[];
  result: PlacementResult;
  /** applicant id to published name, for rendering. */
  names: Map<number, string>;
  poolSize: number;
};

/**
 * Runs a blank-slate allocation for one programme.
 *
 * Deliberately NOT cached across requests: the pool changes when the pipeline
 * runs, and a stale allocation is a wrong answer that looks authoritative.
 */
export async function runAllocation(
  program: string,
  induction: number = CURRENT_INDUCTION,
  /**
   * A candidate the reader supplied for themselves.
   *
   * The original includes it here — its slot browser and placement both read
   * `allCandidates()`, which splices the manual entry in — so a reader sees
   * themselves ranked among the real applicants. It is used for this run and
   * never stored; see `./manual-candidate` for why that is not negotiable.
   */
  manual?: ManualCandidate | null
): Promise<Allocation> {
  const [seats, pool, index, publishedNames, scope] = await Promise.all([
    loadSeats(induction),
    loadPool(induction),
    loadPreferenceIndex(induction),
    loadPublishedNames(induction),
    // Per reader, never cached with the pool — the pool is shared and the scope
    // is a viewing preference.
    activeScope(),
  ]);

  // `loadPublishedNames` is CACHED and shared across every request and every
  // user. Adding the manual candidate to it directly would leak one reader's
  // self-supplied name into everybody else's pages until the cache expired.
  // Copied only when there is something to add.
  const names = manual?.preferences.length
    ? new Map(publishedNames)
    : publishedNames;

  const programs = [...new Set(seats.map((s) => s.program))].sort((a, b) =>
    a.localeCompare(b)
  );

  // Shared with the Merit List's queue, so the two surfaces cannot disagree
  // about what a candidate scores for a seat.
  //
  // The manual candidate is not in the index — nothing about them is stored —
  // so their aggregate answers for every seat. No certificate bonus, because
  // nothing has been verified.
  const manualId = manual?.preferences.length ? MANUAL_ID_BASE : null;

  const effectiveMark = (applicantId: number, key: string) => {
    if (manualId != null && applicantId === manualId) return manual!.marksTotal;
    return (
      index.effectiveMark.get(`${applicantId}::${key}`) ??
      index.baseMark.get(applicantId) ??
      0
    );
  };

  // Only verified applicants compete. Status 1 is Accepted; 2 is Rejected, 11
  // is Pending, and null means no record — none of which is a cleared candidate,
  // so treating null as eligible would let unverified people take seats.
  const candidates: PlacementApplicant[] = pool
    // The reader's status scope decides who competes. Default is "Accepted
    // only" — status 1 — which is what this always did and what `test:placement`
    // grades against.
    .filter((row) => inScope(scope, row.profile_status ?? null))
    .map((row) => ({
      applicantId: row.applicant_id,
      nameFull: names.get(row.applicant_id) ?? "",
      preferences: row.preferences ?? [],
    }));

  if (manualId != null && manual) {
    // Only preferences naming a seat that exists; the engine would drop the
    // rest anyway, and filtering here keeps the numbering contiguous.
    const seatKeys = new Set(
      seats.map((s) => `${s.program.trim()}|${s.specialty.trim()}|${s.hospital.trim()}|${s.quota.trim()}`)
    );

    const preferences = manual.preferences
      .filter((pref) =>
        seatKeys.has(
          `${pref.program.trim()}|${pref.specialty.trim()}|${pref.hospital.trim()}|${pref.quota.trim()}`
        )
      )
      .map((pref, i) => ({ ...pref, preference_no: i + 1 }));

    if (preferences.length) {
      candidates.push({
        applicantId: manualId,
        nameFull: manual.name,
        preferences,
      });
      names.set(manualId, manual.name);
    }
  }

  const result = runPlacement({
    program,
    seats,
    candidates,
    effectiveMark,
  });

  return { program, programs, result, names, poolSize: candidates.length };
}

export type SlotBrowserRow = {
  applicantId: number;
  name: string | null;
  mark: number;
  preferenceNo: number;
  /** Placed here by the simulation. */
  selected: boolean;
  /** Placed somewhere they wanted more, so not really competing here. */
  placedHigher: boolean;
};

export type SlotBrowserResult = {
  slot: AllocationSlot | null;
  rows: SlotBrowserRow[];
  capacity: number;
  cutoff: number | null;
};

/**
 * One slot, with everyone who listed it, ranked.
 *
 * The original calls this "Where Merit Falls". The ranking is by the mark that
 * applies to THIS seat, not the bare aggregate — which is why two candidates
 * can rank differently at two hospitals in the same specialty.
 */
export function browseSlot(
  allocation: Allocation,
  quota: string,
  specialty: string,
  hospital: string
): SlotBrowserResult {
  const slot = allocation.result.slots.find(
    (s) => s.quota === quota && s.specialty === specialty && s.hospital === hospital
  );

  if (!slot) return { slot: null, rows: [], capacity: 0, cutoff: null };

  const rows: SlotBrowserRow[] = [
    ...slot.placed.map((c) => ({
      applicantId: c.applicantId,
      name: allocation.names.get(c.applicantId) ?? null,
      mark: c.mark,
      preferenceNo: c.preferenceNo,
      selected: true,
      placedHigher: false,
    })),
    ...slot.others.map((c) => ({
      applicantId: c.applicantId,
      name: allocation.names.get(c.applicantId) ?? null,
      mark: c.mark,
      preferenceNo: c.preferenceNo,
      selected: false,
      placedHigher: c.placedElsewhereAtBetterPreference,
    })),
  ].sort((a, b) => b.mark - a.mark || a.applicantId - b.applicantId);

  return {
    slot: { ...slot, placedNames: [] },
    rows,
    capacity: slot.capacity,
    cutoff: slot.cutoff,
  };
}
