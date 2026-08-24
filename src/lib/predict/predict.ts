// Type-only import, so this module has no runtime dependencies at all and can
// be loaded directly by a plain `node` test run — which resolves neither the
// `@/` path alias nor extensionless TypeScript imports.
import type { MeritRow, Trend, Volatility } from "../merit/types";

/**
 * The prediction engine, as pure functions.
 *
 * Ported from the live site's `runPredictor` / `runReverseCalc`, with the
 * thresholds and the projection arithmetic preserved exactly. Everything here
 * works on the **normalised** scale — a percentage of each cycle's own marks
 * total — because the total moved from 95 to 30 and comparing raw figures
 * across cycles is meaningless.
 *
 * None of this is a probability. It is a comparison of one number against
 * historical closing merits, and the UI has to keep saying so.
 */

export type Bucket = "safe" | "target" | "reach";

/**
 * Where a score sits relative to a seat's historical average.
 *
 * The bands are the original's, unchanged:
 *   safe   — at least 3 points of max above the average
 *   target — within 5 points below it
 *   reach  — up to 15 points below it
 * Anything further below is dropped rather than shown as a fourth bucket. A
 * seat 40 points out of range is not a "long shot", it is not an option, and
 * listing it would pad the result with false hope.
 */
export const BUCKET_THRESHOLDS = { safe: 3, target: -5, reach: -15 } as const;

export function bucketFor(delta: number): Bucket | null {
  if (delta >= BUCKET_THRESHOLDS.safe) return "safe";
  if (delta >= BUCKET_THRESHOLDS.target) return "target";
  if (delta >= BUCKET_THRESHOLDS.reach) return "reach";
  return null;
}

/**
 * The projected range for the next cycle.
 *
 * Deliberately crude, and the UI must not dress it up: it shifts the latest
 * close by ±2 points if the trend is moving, and widens by the volatility band
 * (±6 / ±3 / ±1.5). It is not a model, it is "last year, nudged".
 */
export type Projection = {
  low: number;
  high: number;
  trend: Trend;
  volatility: Volatility;
};

const TREND_SHIFT: Record<Trend, number> = {
  rising: 2,
  falling: -2,
  stable: 0,
};

const VOLATILITY_SPREAD: Record<Volatility, number> = {
  high: 6,
  medium: 3,
  low: 1.5,
};

export function projectFor(
  latestPct: number | null,
  trend: Trend,
  volatility: Volatility
): Projection | null {
  if (latestPct == null) return null;

  const shift = TREND_SHIFT[trend] ?? 0;
  const spread = VOLATILITY_SPREAD[volatility] ?? 1.5;

  return {
    low: round1(Math.max(0, latestPct + shift - spread)),
    high: round1(Math.min(100, latestPct + shift + spread)),
    trend,
    volatility,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The latest close for a row, normalised.
 *
 * Reads `yearly_pct_of_max` directly rather than going through
 * `merit/query`'s `valueFor`, to keep this module dependency-free. Same rule
 * applies: a missing cycle is `null`, never 0.
 */
export function latestPctOfMax(row: MeritRow): number | null {
  const value = row.yearly_pct_of_max?.[String(row.latest_induction)];
  return typeof value === "number" ? value : null;
}

export type Prediction = {
  row: MeritRow;
  /** The score as a percentage of the current cycle's marks total. */
  userPct: number;
  /** userPct minus the row's historical average, in points of max. */
  delta: number;
  bucket: Bucket;
  projection: Projection | null;
};

export type PredictQuery = {
  program?: string;
  quota?: string;
};

/**
 * Classify every seat combination against a score.
 *
 * `marks` is on the current cycle's scale; `totalMarks` converts it. Passing a
 * score from a different cycle's scale would silently produce a wrong answer,
 * which is why the caller is given the policy rather than a bare number.
 */
export function predict(
  rows: MeritRow[],
  marks: number,
  totalMarks: number,
  query: PredictQuery = {}
): Prediction[] {
  if (!(totalMarks > 0)) return [];

  const userPct = (marks / totalMarks) * 100;

  const predictions: Prediction[] = [];

  for (const row of rows) {
    if (query.program && row.program !== query.program) continue;
    if (query.quota && row.quota !== query.quota) continue;
    if (typeof row.avg_pct_of_max !== "number") continue;

    const delta = userPct - row.avg_pct_of_max;
    const bucket = bucketFor(delta);
    if (!bucket) continue;

    predictions.push({
      row,
      userPct,
      delta,
      bucket,
      projection: projectFor(latestPctOfMax(row), row.trend, row.volatility),
    });
  }

  // Best margin first within each bucket, which is how the original sorts and
  // is the order a candidate reads in anyway.
  return predictions.sort((a, b) => b.delta - a.delta);
}

export function countByBucket(predictions: Prediction[]) {
  return {
    safe: predictions.filter((p) => p.bucket === "safe").length,
    target: predictions.filter((p) => p.bucket === "target").length,
    reach: predictions.filter((p) => p.bucket === "reach").length,
  };
}

/**
 * Share of results resting on four or more years of data.
 *
 * Surfaced because the buckets look equally authoritative whether they came
 * from eleven observations or one, and they are not equally trustworthy.
 */
export function highConfidenceShare(predictions: Prediction[]): number {
  if (!predictions.length) return 0;
  const high = predictions.filter((p) => p.row.confidence === "high").length;
  return (high / predictions.length) * 100;
}

/* ------------------------------------------------------------------------ */
/* Target mode — "what would I have needed?"                                 */
/* ------------------------------------------------------------------------ */

export type Requirement = {
  row: MeritRow;
  avgPct: number;
  latestPct: number | null;
  /** Raw marks equivalent of the latest close, on the current scale. */
  latestRaw: number | null;
  projectedLow: number;
  projectedHigh: number;
  /** The projected upper bound, in marks on the current cycle's scale. */
  neededMarks: number;
  seats: number | null;
};

/**
 * What a given seat has historically demanded.
 *
 * The projection here is a different shape from the forward one, and that is
 * the original's design, not an oversight: a rising seat projects upward from
 * the latest close, a falling one downward, and a stable one spreads around the
 * mean. It is then capped at the highest figure that seat has ever actually
 * closed at — the honest ceiling, since projecting past every observed result
 * would be inventing a cutoff.
 */
export function requirementsFor(
  rows: MeritRow[],
  totalMarks: number
): Requirement[] {
  return rows.map((row) => {
    const pcts = Object.values(row.yearly_pct_of_max ?? {}).filter(
      (v): v is number => typeof v === "number" && v > 0
    );

    const avgPct = row.avg_pct_of_max;
    const latestPct = latestPctOfMax(row);

    const mean = pcts.length
      ? pcts.reduce((a, b) => a + b, 0) / pcts.length
      : (avgPct ?? 0);

    // A single observation has no spread; 5 points is the original's fallback
    // and is deliberately wide, because one year tells you very little.
    const stddev =
      pcts.length > 1
        ? Math.sqrt(
            pcts.reduce((s, v) => s + (v - mean) ** 2, 0) / pcts.length
          )
        : 5;

    const maxObserved = pcts.length
      ? Math.max(...pcts)
      : Math.max(avgPct ?? 0, latestPct ?? 0);

    const base = latestPct ?? mean;

    let low: number;
    let high: number;
    if (row.trend === "rising") {
      low = base;
      high = base + stddev * 0.5;
    } else if (row.trend === "falling") {
      low = base - stddev * 0.5;
      high = base;
    } else {
      low = mean - stddev * 0.3;
      high = mean + stddev * 0.3;
    }

    // Round BEFORE clamping, not after. Rounding a capped 66.47 up to 66.5
    // pushes it back above the ceiling it was just capped to, so the panel
    // would show a projected cutoff higher than the seat has ever closed at.
    low = Math.max(0, round1(low));
    high = Math.min(round1(high), round1(maxObserved));

    return {
      row,
      avgPct,
      latestPct,
      latestRaw:
        latestPct != null ? round2((latestPct / 100) * totalMarks) : null,
      projectedLow: low,
      projectedHigh: high,
      // Derived from the value actually displayed, so the marks figure and the
      // percentage range beside it cannot disagree by a hundredth.
      neededMarks: round2((high / 100) * totalMarks),
      seats: row.yearly_seats?.[String(row.latest_induction)] ?? null,
    };
  });
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Position among historical closing merits. Not a chance of a seat. */
export function percentileFor(userPct: number, distribution: number[]): number {
  if (!distribution.length) return 0;
  const below = distribution.filter((v) => v < userPct).length;
  return Math.round((below / distribution.length) * 100);
}
