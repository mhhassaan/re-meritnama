/**
 * The merit formula, as published policy data.
 *
 * The calculator is **entirely data-driven**: nothing about which components
 * exist, what they are worth, or how they score is written in code. It all
 * comes from `policy_by_induction.json`, which is the ingest pipeline's output.
 *
 * That is not incidental. The formula was rewritten between Induction 20 and
 * 21 — the total dropped from 35 marks to 30, Matric, Intermediate, Parent
 * Institute and the score-based FCPS Part-I were removed outright, and MDCAT
 * was introduced. A calculator with the components hardcoded would have needed
 * a code change and a deploy to stay correct; this one needs a data refresh.
 */

export type ComponentType =
  | "percentage"
  | "count"
  | "years"
  | "months"
  | "score"
  | "boolean"
  | "tiered_select"
  | "fcps_jcat_combo";

export type Tier = {
  label: string;
  value: number;
};

/** FCPS Part-I is scored by attempt number, not by mark. */
export type FcpsTier = {
  label: string;
  marks: number;
};

/** JCAT is scored by banded percentage. */
export type JcatThreshold = {
  /** Inclusive lower bound. */
  min: number;
  value: number;
  label: string;
};

export type PolicyComponent = {
  key: string;
  label: string;
  max_marks: number;
  type: ComponentType;
  description: string;
  /**
   * `false` for components that exist in the historical record but carry no
   * marks in this cycle. They are kept in the data rather than deleted so the
   * removal is visible — a candidate who scored well on Matric deserves to see
   * that it no longer counts, not to find it silently absent.
   */
  included: boolean;
  per_year?: number;
  per_item?: number;
  per_3_months?: number;
  score_max?: number;
  tiers?: Tier[];
  fcps_tiers?: FcpsTier[];
  jcat_thresholds?: JcatThreshold[];
};

export type CalculatorPolicy = {
  induction: number;
  year: number;
  /** e.g. "2026 (Induction 21 - June / July 2026)". */
  label: string;
  totalMarks: number;
  /** What changed this cycle, in the pipeline's own words. */
  notes: string | null;
  /** The notification this formula comes from. */
  policyRef: string | null;
  /** Short observations about the formula change. */
  tidbits: string[];
  components: PolicyComponent[];
};

/** What the user has entered, keyed by component. */
export type CalculatorInput = Record<string, string>;

export type ComponentResult = {
  key: string;
  label: string;
  /** What the user entered, rendered for display. */
  value: string;
  earned: number;
  max: number;
};

export type CalculatorResult = {
  total: number;
  totalMarks: number;
  breakdown: ComponentResult[];
};

/**
 * Where a score sits against the field.
 *
 * Deliberately relative, not a fixed cutoff: the marks total has moved from 95
 * to 30, so "23.6 marks" means nothing on its own. The score is converted to a
 * percentage of the cycle's maximum and ranked against every closing merit in
 * the record.
 */
export type BandId = "top" | "high" | "mid" | "low";

export type Band = {
  id: BandId;
  label: string;
  description: string;
};
