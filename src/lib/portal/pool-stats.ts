/**
 * The Candidate Pool, reduced to counts.
 *
 * Pure and dependency-free, so `pool-stats.test.mjs` imports this exact module
 * rather than a copy. Everything here is arithmetic over rows the caller
 * supplies; nothing reaches a database.
 *
 * ## Why this returns aggregates and never rows
 *
 * The original's Candidate Pool is a searchable roster: one line per applicant
 * with their name, marks and programmes, and a click to open their full
 * preference list. That table is the exact artefact this rebuild exists to
 * undo. Three files of it were downloadable by anyone, unauthenticated, and
 * `public.applicants` was built with **no name and no contact details** so that
 * a bug in the engine could not become a leak.
 *
 * The remaining columns are not harmless either. `merit_entries` publishes the
 * name and mark of everyone who *placed* — 1,453 people — but nobody has ever
 * published a mark for the 2,021 who did not, and printing "applicant 31882 —
 * 18.07" would make this project the first to do it. An applicant id is not a
 * secret; an unpublished mark attached to one is a disclosure.
 *
 * So the page answers questions about the pool rather than about people in it.
 * Every field below is a count over the whole pool, and the module cannot
 * return an individual even if a caller asks.
 */

export type PoolPreference = {
  preference_no: number;
  program: string;
  quota: string;
  specialty: string;
  hospital: string;
};

export type PoolStatsRow = {
  applicant_id: number;
  marks_total: number | null;
  profile_status: number | null;
  preferences: PoolPreference[] | null;
};

/**
 * Programmes the portal records a candidate as having applied to.
 *
 * This is `applied_in`, and it is **not** derivable from the preference list.
 * The two disagree on the real data: 100 applicants have `applied_in` empty
 * while only one filed no preferences at all. The original's stats bar counts
 * this field, so ours does too — deriving the same numbers from preferences
 * produced a bar that was close enough to look right and wrong in every cell.
 */
export type AppliedIndex = Map<number, string[]>;

export type Band = {
  label: string;
  count: number;
  /** Inclusive lower bound, for the tooltip and for tests. */
  from: number;
  /** Exclusive upper bound, except on the last band. */
  to: number;
};

export type PoolStats = {
  total: number;

  /** Applicants holding at least one preference in each programme. */
  byProgram: Array<{ program: string; applicants: number }>;
  /** Listed seats in two or more programmes. */
  multiProgram: number;
  /**
   * Recorded as having applied to no programme at all.
   *
   * Counted from `applied_in`, as the original does. Someone here cannot be
   * placed anywhere in any round.
   */
  noPreferences: number;
  /**
   * Aggregate below 5.
   *
   * The original flags these as "data likely needs re-updating" rather than as
   * weak candidates, and the wording is kept: on a scale whose maximum is 30, a
   * 2 is far more likely to be an unfinished profile than a real score.
   */
  lowMarks: number;

  /**
   * Portal verification, by its own status ids.
   *
   * Only **1** competes. 2 is rejected, 11 is pending, and a missing row is no
   * record at all — treating any of those as cleared would let unverified
   * people take seats in every simulation on the site.
   */
  verification: {
    accepted: number;
    pending: number;
    rejected: number;
    noRecord: number;
  };

  /** Aggregate marks, in fixed bands. */
  marks: {
    bands: Band[];
    lowest: number;
    highest: number;
    median: number;
    mean: number;
  };

  /** How many seats each applicant listed. */
  preferenceDepth: {
    bands: Band[];
    total: number;
    mean: number;
    longest: number;
  };

  /** How much of the pool the gazette has ever named. */
  published: {
    named: number;
    unnamed: number;
  };
};

/** Programme order the original prints, and the order the portal uses. */
const PROGRAM_ORDER = ["FCPS", "MS", "MD", "FCPS Dentistry", "MDS"];

const MARK_BAND_WIDTH = 2;

/**
 * Preference-list lengths.
 *
 * The bands run much further than they first look like they should. Induction
 * 21 filed 180,784 preferences across 3,474 applicants — a mean of 52 — and
 * the longest single list is 358 seats. A top band of "41+" therefore swallowed
 * 42% of the pool and said nothing, which is the opposite of what a
 * distribution is for.
 */
const DEPTH_BANDS: Array<{ label: string; from: number; to: number }> = [
  { label: "None", from: 0, to: 1 },
  { label: "1", from: 1, to: 2 },
  { label: "2–5", from: 2, to: 6 },
  { label: "6–10", from: 6, to: 11 },
  { label: "11–20", from: 11, to: 21 },
  { label: "21–40", from: 21, to: 41 },
  { label: "41–80", from: 41, to: 81 },
  { label: "81–160", from: 81, to: 161 },
  { label: "161+", from: 161, to: Infinity },
];

const t = (v: string | null | undefined) => (v ?? "").trim();

export function buildPoolStats(
  rows: PoolStatsRow[],
  /** Applicant ids the gazette has published a name for, across all rounds. */
  publishedIds: Set<number> = new Set(),
  /**
   * `applied_in` per applicant, when the roster has been loaded.
   *
   * Absent, the counts fall back to the preference list, which is the best
   * available answer but not the original's.
   */
  appliedIn?: AppliedIndex
): PoolStats {
  const programCounts = new Map<string, number>();
  let multiProgram = 0;
  let noPreferences = 0;
  let lowMarks = 0;

  const verification = { accepted: 0, pending: 0, rejected: 0, noRecord: 0 };

  const marks: number[] = [];
  const depths: number[] = [];

  let named = 0;

  for (const row of rows) {
    const preferences = row.preferences ?? [];

    // `applied_in` where the roster supplied it, the preference list otherwise.
    const recorded = appliedIn?.get(row.applicant_id);
    const programs = new Set<string>();
    if (recorded) {
      for (const program of recorded) if (program) programs.add(program);
    } else {
      for (const preference of preferences) {
        const program = t(preference.program);
        if (program) programs.add(program);
      }
    }

    for (const program of programs) {
      programCounts.set(program, (programCounts.get(program) ?? 0) + 1);
    }
    if (programs.size >= 2) multiProgram += 1;

    // The original counts "no prefs" as "applied to no programme", which is a
    // different question from "filed no preference rows" — 100 against 1. The
    // second fact is not lost: it is the "None" band of the depth distribution.
    if (recorded ? programs.size === 0 : preferences.length === 0) {
      noPreferences += 1;
    }

    // Null is counted as zero rather than skipped: an applicant with no mark
    // recorded is exactly the case the original's "<5" flag exists to surface,
    // and dropping them would shrink the very total that makes it meaningful.
    const mark = Number(row.marks_total ?? 0);
    marks.push(mark);
    if (mark < 5) lowMarks += 1;

    depths.push(preferences.length);

    if (row.profile_status === 1) verification.accepted += 1;
    else if (row.profile_status === 11) verification.pending += 1;
    else if (row.profile_status === 2) verification.rejected += 1;
    else verification.noRecord += 1;

    if (publishedIds.has(row.applicant_id)) named += 1;
  }

  const byProgram = [...programCounts.entries()]
    .map(([program, applicants]) => ({ program, applicants }))
    .sort((a, b) => {
      const ai = PROGRAM_ORDER.indexOf(a.program);
      const bi = PROGRAM_ORDER.indexOf(b.program);
      // Known programmes in the portal's own order; anything new falls to the
      // end by size rather than being silently dropped.
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return b.applicants - a.applicants;
    });

  return {
    total: rows.length,
    byProgram,
    multiProgram,
    noPreferences,
    lowMarks,
    verification,
    marks: {
      bands: markBands(marks),
      lowest: marks.length ? Math.min(...marks) : 0,
      highest: marks.length ? Math.max(...marks) : 0,
      median: median(marks),
      mean: mean(marks),
    },
    preferenceDepth: {
      bands: depthBands(depths),
      total: depths.reduce((sum, n) => sum + n, 0),
      mean: mean(depths),
      longest: depths.length ? Math.max(...depths) : 0,
    },
    published: {
      named,
      unnamed: rows.length - named,
    },
  };
}

/**
 * Fixed-width bands over the observed range.
 *
 * Fixed rather than quantile: equal-count buckets would flatten the shape being
 * asked about, which is where the mass sits relative to a cutoff. Empty bands
 * at each end are trimmed, so a scale that runs to 30 does not print eight
 * empty rows when nobody scored above 26.
 */
function markBands(values: number[]): Band[] {
  if (!values.length) return [];

  const top = Math.max(...values);
  // `ceil` alone, with no epsilon: a top mark of exactly 30 gives 15 bands
  // ending 28–30, and the sweep below catches the value sitting on that upper
  // edge. Nudging the input up instead opened a 16th band, 30–32, holding the
  // single highest scorer and nothing else.
  const bandCount = Math.max(1, Math.ceil(top / MARK_BAND_WIDTH));

  const bands: Band[] = [];
  for (let i = 0; i < bandCount; i += 1) {
    const from = i * MARK_BAND_WIDTH;
    const to = from + MARK_BAND_WIDTH;
    bands.push({
      label: `${from}–${to}`,
      from,
      to,
      count: values.filter((v) => v >= from && v < to).length,
    });
  }

  // The maximum falls on the upper edge of the last band, which is exclusive
  // everywhere else. Without this the single highest scorer vanishes.
  const last = bands[bands.length - 1];
  last.count += values.filter((v) => v >= last.to).length;

  return trimEmptyEnds(bands);
}

function depthBands(values: number[]): Band[] {
  return DEPTH_BANDS.map(({ label, from, to }) => ({
    label,
    from,
    to,
    count: values.filter((v) => v >= from && v < to).length,
  }));
}

function trimEmptyEnds(bands: Band[]): Band[] {
  let start = 0;
  let end = bands.length - 1;
  while (start < end && bands[start].count === 0) start += 1;
  while (end > start && bands[end].count === 0) end -= 1;
  return bands.slice(start, end + 1);
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
