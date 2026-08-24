/**
 * Seat allocation from a blank slate.
 *
 * A port of the original's `runPlacement` in `sim-placement.js`, itself a
 * translation of `merit.py`. This is the **other** allocation algorithm — see
 * `./cascade.ts` for the difference, because confusing the two produces a
 * confident answer to a question nobody asked.
 *
 * Here nobody holds a seat to begin with. Every candidate walks their own
 * preference list in order, the highest mark wins each contest, and someone
 * already holding a seat is displaced when a stronger candidate wants it. That
 * answers "who would get what if allocation ran today from scratch", which is
 * the question *before* a round is published. The cascade answers the one that
 * only makes sense after.
 *
 * Input shapes are the DATABASE's, not the source files' — `public.seats` rows
 * and `candidates.preferences` as stored, with specialty and hospital already
 * resolved to names. The cascade takes the raw file shapes because it is graded
 * against the published rounds; this one serves the app.
 *
 * Pure and dependency-free, so the node test loads this exact module.
 */

/** One seat the candidate applied for, as stored in `candidates.preferences`. */
export type PlacementPreference = {
  preference_no: number;
  program: string;
  quota: string;
  specialty: string;
  hospital: string;
  /**
   * The parent-institute figure the portal carries per preference.
   *
   * Zero across all 180,784 preferences on Induction 21, so the bonus adds
   * nothing today. Carried because the rule is real and a later cycle may
   * populate it.
   */
  parent_institute_marks?: number;
};

export type PlacementApplicant = {
  applicantId: number;
  nameFull: string;
  preferences: PlacementPreference[];
};

/** A seat and its capacity, as stored in `public.seats`. */
export type PlacementSeat = {
  program: string;
  quota: string;
  specialty: string;
  hospital: string;
  seats: number;
};

/**
 * Quota tracks.
 *
 * Armed Force seats are a separate competition, not a harder version of the
 * same one. The original models this by splitting each candidate into two
 * competitors — one per track — each carrying only that track's preferences. A
 * candidate with preferences in both is genuinely in both contests and can win
 * a seat in either.
 */
export type QuotaTrack = "civilian" | "armed";

export function quotaTrack(quota: string): QuotaTrack {
  const normalised = String(quota ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Written as a test on the armed case rather than a list of civilian quotas,
  // so a newly-named civilian quota cannot silently drop out of the contest.
  return normalised.includes("armed force") ? "armed" : "civilian";
}

/** Runaway guard. Real data converges in a handful of passes. */
const MAX_PASSES = 100;

export type PlacedCandidate = {
  applicantId: number;
  nameFull: string;
  track: QuotaTrack;
  /** Effective mark for THIS seat, including any certificate bonus. */
  mark: number;
  preferenceNo: number;
};

export type SlotResult = {
  program: string;
  quota: string;
  specialty: string;
  hospital: string;
  capacity: number;
  /** Placed here, best mark first. */
  placed: PlacedCandidate[];
  /**
   * Everyone else who listed this slot, best mark first.
   *
   * `placedElsewhereAtBetterPreference` is what the original renders as a faded
   * row: the algorithm put them somewhere they wanted more, so they are not
   * really competing here, and counting them as competition overstates it.
   */
  others: Array<
    PlacedCandidate & {
      placed: boolean;
      placedElsewhereAtBetterPreference: boolean;
    }
  >;
  /**
   * The lowest mark among the placed — the cutoff.
   *
   * Null unless the slot actually filled. There is no cutoff for a seat nobody
   * had to compete for, and printing the lowest of two when three were
   * available invents a threshold that never existed.
   */
  cutoff: number | null;
  /** Highest-scoring genuine waiter; first to benefit if a placed candidate withdraws. */
  nextInLine: PlacedCandidate | null;
};

export type PlacementResult = {
  program: string;
  slots: SlotResult[];
  stats: {
    passes: number;
    competitors: number;
    placed: number;
    unplaced: number;
    seats: number;
    filled: number;
  };
};

export type PlacementInput = {
  program: string;
  seats: PlacementSeat[];
  candidates: PlacementApplicant[];
  /**
   * Effective mark per candidate per seat key, certificate bonus included.
   *
   * Passed in rather than computed here: the bonus rule is shared with the
   * cascade, and two copies of it would drift apart.
   */
  effectiveMark: (applicantId: number, seatKey: string) => number;
  /** PMDC's +5 for competing at your own parent institute. Inert on this cycle. */
  parentInstituteBonus?: boolean;
};

const keyOf = (program: string, specialty: string, hospital: string, quota: string) =>
  `${program.trim()}|${specialty.trim()}|${hospital.trim()}|${quota.trim()}`;

const prefKey = (p: PlacementPreference) =>
  keyOf(p.program, p.specialty, p.hospital, p.quota);

type Competitor = {
  applicantId: number;
  nameFull: string;
  track: QuotaTrack;
  preferences: PlacementPreference[];
  /** What this competitor is sorted by across the whole run. */
  sortMark: number;
  placedAt: string | null;
};

export function runPlacement(input: PlacementInput): PlacementResult {
  const { program, seats, candidates, effectiveMark, parentInstituteBonus } = input;

  const markFor = (applicantId: number, preference: PlacementPreference): number => {
    const base = effectiveMark(applicantId, prefKey(preference));
    const bonus =
      parentInstituteBonus && typeof preference.parent_institute_marks === "number"
        ? preference.parent_institute_marks
        : 0;
    return base + bonus;
  };

  // ── Slots ────────────────────────────────────────────────────────────────
  const slots = new Map<
    string,
    { row: PlacementSeat; capacity: number; placed: PlacedCandidate[] }
  >();

  for (const row of seats) {
    if (row.program.trim() !== program) continue;
    slots.set(keyOf(row.program, row.specialty, row.hospital, row.quota), {
      row,
      capacity: row.seats,
      placed: [],
    });
  }

  // ── Competitors ──────────────────────────────────────────────────────────
  const competitors: Competitor[] = [];

  for (const candidate of candidates) {
    for (const track of ["civilian", "armed"] as const) {
      const preferences = (candidate.preferences ?? [])
        .filter((p) => p.program.trim() === program && quotaTrack(p.quota) === track)
        .filter((p) => slots.has(prefKey(p)))
        .sort((a, b) => a.preference_no - b.preference_no);

      if (!preferences.length) continue;

      // Sorted by the best mark achievable anywhere in this track, not by the
      // bare aggregate. A certificate bonus that applies to one specialty must
      // lift the candidate where it counts without lifting them where it does
      // not.
      const marks = preferences.map((p) => markFor(candidate.applicantId, p));

      competitors.push({
        applicantId: candidate.applicantId,
        nameFull: candidate.nameFull,
        track,
        preferences,
        sortMark: Math.max(...marks),
        placedAt: null,
      });
    }
  }

  // ── Deferred acceptance ──────────────────────────────────────────────────
  let passes = 0;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    passes = pass + 1;

    const unplaced = competitors
      .filter((c) => c.placedAt == null)
      .sort((a, b) => b.sortMark - a.sortMark || a.applicantId - b.applicantId);

    if (!unplaced.length) break;

    let changed = false;

    for (const competitor of unplaced) {
      for (const preference of competitor.preferences) {
        const slotKey = prefKey(preference);
        const slot = slots.get(slotKey);
        if (!slot) continue;

        const mark = markFor(competitor.applicantId, preference);
        const entry: PlacedCandidate = {
          applicantId: competitor.applicantId,
          nameFull: competitor.nameFull,
          track: competitor.track,
          mark,
          preferenceNo: preference.preference_no,
        };

        if (slot.placed.length < slot.capacity) {
          slot.placed.push(entry);
          competitor.placedAt = slotKey;
          changed = true;
          break;
        }

        // Full. Displace the weakest occupant, but only when genuinely beaten:
        // on a tie the incumbent stays, or two equal candidates would swap
        // places forever and the run would never converge.
        const weakest = slot.placed.reduce((lowest, c) =>
          c.mark < lowest.mark ? c : lowest
        );
        if (mark <= weakest.mark) continue;

        slot.placed = slot.placed.filter(
          (c) => !(c.applicantId === weakest.applicantId && c.track === weakest.track)
        );
        const evicted = competitors.find(
          (c) => c.applicantId === weakest.applicantId && c.track === weakest.track
        );
        if (evicted) evicted.placedAt = null;

        slot.placed.push(entry);
        competitor.placedAt = slotKey;
        changed = true;
        break;
      }
    }

    if (!changed) break;
  }

  // ── Everyone who listed a slot but did not land on it ────────────────────
  const others = new Map<string, SlotResult["others"]>();

  for (const competitor of competitors) {
    const placedPreferenceNo = competitor.placedAt
      ? (competitor.preferences.find((p) => prefKey(p) === competitor.placedAt)
          ?.preference_no ?? null)
      : null;

    for (const preference of competitor.preferences) {
      const slotKey = prefKey(preference);
      if (slotKey === competitor.placedAt) continue;
      if (!slots.has(slotKey)) continue;

      const list = others.get(slotKey) ?? [];
      list.push({
        applicantId: competitor.applicantId,
        nameFull: competitor.nameFull,
        track: competitor.track,
        mark: markFor(competitor.applicantId, preference),
        preferenceNo: preference.preference_no,
        placed: competitor.placedAt != null,
        placedElsewhereAtBetterPreference:
          placedPreferenceNo != null && placedPreferenceNo < preference.preference_no,
      });
      others.set(slotKey, list);
    }
  }

  // ── Result ───────────────────────────────────────────────────────────────
  const results: SlotResult[] = [];
  let filled = 0;

  for (const [slotKey, slot] of slots) {
    slot.placed.sort((a, b) => b.mark - a.mark || a.applicantId - b.applicantId);
    const rest = (others.get(slotKey) ?? []).sort(
      (a, b) => b.mark - a.mark || a.applicantId - b.applicantId
    );

    filled += slot.placed.length;

    results.push({
      program: slot.row.program.trim(),
      quota: slot.row.quota.trim(),
      specialty: slot.row.specialty.trim(),
      hospital: slot.row.hospital.trim(),
      capacity: slot.capacity,
      placed: slot.placed,
      others: rest,
      cutoff:
        slot.placed.length > 0 && slot.placed.length >= slot.capacity
          ? slot.placed[slot.placed.length - 1].mark
          : null,
      // Only someone genuinely waiting. Somebody already sitting on a seat they
      // preferred is not next in line here — they would not take this one.
      nextInLine: rest.find((c) => !c.placedElsewhereAtBetterPreference) ?? null,
    });
  }

  results.sort(
    (a, b) =>
      a.specialty.localeCompare(b.specialty) ||
      a.hospital.localeCompare(b.hospital) ||
      a.quota.localeCompare(b.quota)
  );

  const placed = competitors.filter((c) => c.placedAt != null).length;

  return {
    program,
    slots: results,
    stats: {
      passes,
      competitors: competitors.length,
      placed,
      unplaced: competitors.length - placed,
      seats: [...slots.values()].reduce((sum, s) => sum + s.capacity, 0),
      filled,
    },
  };
}
