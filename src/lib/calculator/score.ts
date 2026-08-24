import type {
  Band,
  CalculatorInput,
  CalculatorPolicy,
  CalculatorResult,
  ComponentResult,
  PolicyComponent,
} from "./types";

/**
 * The merit formula, as pure functions.
 *
 * Kept free of React and of the DOM on purpose: this is the number a candidate
 * makes a career decision from, and it should be verifiable without rendering
 * anything. Every branch below is a port of the live site's engine, checked
 * against its output.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The sub-keys a combo component reads, so the UI and the scorer agree. */
export const FCPS_TYPE_KEY = (key: string) => `${key}_type`;
export const FCPS_ATTEMPT_KEY = (key: string) => `${key}_attempt`;
export const JCAT_PCT_KEY = (key: string) => `${key}_jcat_pct`;

function parse(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Marks earned for one component.
 *
 * Every branch clamps to `max_marks`. The clamp is load-bearing, not defensive
 * tidiness: without it a mistyped 800% aggregate would award 120 marks out of
 * 15 and produce a total that looks authoritative and is nonsense.
 */
export function scoreComponent(
  component: PolicyComponent,
  input: CalculatorInput
): ComponentResult {
  const { key, label, max_marks, type } = component;
  const blank: ComponentResult = { key, label, value: "—", earned: 0, max: max_marks };

  switch (type) {
    case "percentage": {
      const pct = parse(input[key]);
      if (pct == null) return blank;
      return {
        ...blank,
        value: `${pct}%`,
        earned: Math.min((pct / 100) * max_marks, max_marks),
      };
    }

    case "count": {
      const count = parse(input[key]);
      if (count == null) return blank;
      return {
        ...blank,
        value: String(count),
        earned: Math.min(count * (component.per_item ?? 1), max_marks),
      };
    }

    case "years": {
      const years = parse(input[key]);
      if (years == null) return blank;
      return {
        ...blank,
        value: `${years} year${years === 1 ? "" : "s"}`,
        earned: Math.min(years * (component.per_year ?? 1), max_marks),
      };
    }

    case "months": {
      const months = parse(input[key]);
      if (months == null) return blank;
      // Whole three-month blocks only — a partial block earns nothing, which is
      // how the policy reads and how the original implemented it.
      const blocks = Math.floor(months / 3);
      return {
        ...blank,
        value: `${months} month${months === 1 ? "" : "s"}`,
        earned: Math.min(blocks * (component.per_3_months ?? 1.25), max_marks),
      };
    }

    case "score": {
      const raw = parse(input[key]);
      if (raw == null) return blank;
      const outOf = component.score_max ?? 1100;
      return {
        ...blank,
        value: `${raw} / ${outOf}`,
        earned: Math.min((raw / outOf) * max_marks, max_marks),
      };
    }

    case "boolean": {
      const yes = input[key] === "yes";
      return { ...blank, value: yes ? "Yes" : "No", earned: yes ? max_marks : 0 };
    }

    case "tiered_select": {
      const raw = input[key];
      const tier = component.tiers?.find((t) => String(t.value) === raw);
      if (!tier) return blank;
      return {
        ...blank,
        value: tier.label,
        earned: Math.min(tier.value, max_marks),
      };
    }

    case "fcps_jcat_combo": {
      const qualification = input[FCPS_TYPE_KEY(key)];

      if (qualification === "fcps") {
        const raw = input[FCPS_ATTEMPT_KEY(key)];
        const tier = component.fcps_tiers?.find((t) => String(t.marks) === raw);
        // An attempt is identified by its label, not its marks, because the
        // 4th-and-beyond tier is worth 0 — the same as not answering. Matching
        // on the label keeps "4th attempt, 0 marks" distinct from "unanswered".
        const byLabel = component.fcps_tiers?.find((t) => t.label === raw);
        const chosen = byLabel ?? tier;
        if (!chosen) return blank;
        return {
          ...blank,
          value: `FCPS Part-I · ${chosen.label}`,
          earned: Math.min(chosen.marks, max_marks),
        };
      }

      if (qualification === "jcat") {
        const pct = parse(input[JCAT_PCT_KEY(key)]);
        if (pct == null) return blank;
        // Highest threshold first, so the first match is the right band.
        const bands = [...(component.jcat_thresholds ?? [])].sort(
          (a, b) => b.min - a.min
        );
        const band = bands.find((t) => pct >= t.min);
        const earned = band ? Math.min(band.value, max_marks) : 0;
        return {
          ...blank,
          value: `JCAT ${pct}% · ${band?.label ?? "—"}`,
          earned,
        };
      }

      if (qualification === "none") {
        return { ...blank, value: "Neither / not applicable", earned: 0 };
      }

      return blank;
    }

    default:
      return blank;
  }
}

export function scoreAll(
  policy: CalculatorPolicy,
  input: CalculatorInput
): CalculatorResult {
  const breakdown = policy.components
    .filter((c) => c.included)
    .map((component) => {
      const result = scoreComponent(component, input);
      return { ...result, earned: round2(result.earned) };
    });

  return {
    total: round2(breakdown.reduce((sum, r) => sum + r.earned, 0)),
    totalMarks: policy.totalMarks,
    breakdown,
  };
}

const BANDS: Record<string, Band> = {
  top: {
    id: "top",
    label: "Top tier",
    description:
      "Exceptional score — almost every specialty is within reach.",
  },
  high: {
    id: "high",
    label: "High",
    description: "Strong score. Many competitive specialties are accessible.",
  },
  mid: {
    id: "mid",
    label: "Mid range",
    description:
      "Average range. Plenty of good options — focus on moderate-demand specialties.",
  },
  low: {
    id: "low",
    label: "Low",
    description:
      "Below average for the most competitive options, but many specialties are still available.",
  },
};

/**
 * Where a total sits against every closing merit on record.
 *
 * The score is first converted to a percentage of this cycle's maximum, because
 * the raw number is not comparable to anything — 23.6 out of 30 and 23.6 out of
 * 95 are different candidates. It is then ranked against the historical
 * distribution.
 *
 * This is a **position among past closing merits**, not a probability of
 * getting a seat. The UI has to say so; a percentile that reads as a chance is
 * the single most dangerous thing this page could imply.
 */
export function bandFor(
  total: number,
  totalMarks: number,
  distribution: number[]
): { band: Band; percentile: number } {
  if (!distribution.length || totalMarks <= 0) {
    return { band: BANDS.mid, percentile: 0 };
  }

  const pct = (total / totalMarks) * 100;
  const below = distribution.filter((v) => v < pct).length;
  const percentile = (below / distribution.length) * 100;

  if (percentile >= 80) return { band: BANDS.top, percentile };
  if (percentile >= 60) return { band: BANDS.high, percentile };
  if (percentile >= 40) return { band: BANDS.mid, percentile };
  return { band: BANDS.low, percentile };
}
