/**
 * Shapes of the curated merit aggregates.
 *
 * These files are the output of the ingest pipeline (out of scope for this
 * product) and contain **no personal fields** — only closing merits per
 * seat combination. That is why they can live in `public/` while candidate
 * records cannot.
 */

/** Keys are induction numbers as strings: "8" … "20". */
export type ByInduction<T> = Record<string, T>;

export type Trend = "rising" | "falling" | "stable";
export type Volatility = "low" | "medium" | "high";
export type Confidence = "low" | "medium" | "high";

/** One (program, quota, specialty, hospital) combination across all cycles. */
export type MeritRow = {
  program: string;
  quota: string;
  specialty: string;
  hospital: string;

  /** Raw closing merit, on that cycle's own scale. */
  yearly_merit: ByInduction<number>;
  /** The same values normalised to a percentage of that cycle's total marks. */
  yearly_pct_of_max: ByInduction<number>;
  /** Where that closing merit sat among all candidates in the cycle. */
  yearly_percentile: ByInduction<number>;
  yearly_seats: ByInduction<number>;

  avg_closing_merit: number;
  avg_pct_of_max: number;
  stddev: number;
  latest_merit: number;
  latest_induction: number;

  trend: Trend;
  volatility: Volatility;
  /** Derived from how many cycles of data exist — 4+ years reads as high. */
  confidence: Confidence;
  data_points: number;
};

/** Scoring policy for one induction cycle. */
export type InductionPolicy = {
  induction_id: number;
  year: number;
  label: string;
  policy_label: string;
  policy_ref: string;
  /**
   * Total marks available that cycle. This is the number that makes raw merits
   * incomparable across years: it moved 95 → 60 → 35 → 30 between inductions 8
   * and 21, so a raw 70 in Induction 8 and a raw 25 in Induction 20 are not on
   * the same scale.
   */
  total_marks: number;
  active_components: string[];
  active_component_labels?: string[];
};

/**
 * How merit figures are displayed.
 *
 * `normalised` is the default. Raw numbers from different policy eras are not
 * comparable, and showing them side by side without a scale marker invites
 * exactly the wrong conclusion.
 */
export type MeritScale = "normalised" | "raw";
