import type { MeritRow } from "../merit/types";

/**
 * Specialty comparison — the matrix behind `/app/compare`.
 *
 * Pure and dependency-free (types only), so the node test can import the real
 * module with an explicit `.ts` extension rather than a copy of it.
 *
 * The original builds a **transposed** table: metrics run down the left, one
 * column per selected combination. That framing is kept exactly — same metrics,
 * same order, same wording — because a candidate comparing three seats reads
 * across a row to answer one question at a time.
 */

/** Up to three combinations, as the original allows. */
export const MAX_COLUMNS = 3;
/** Below two there is nothing to compare. */
export const MIN_COLUMNS = 2;

/** How many trailing cycles get their own Cutoff/Seats row pair. */
export const HISTORY_CYCLES = 5;

/**
 * A combination, encoded for a `<select>` value and a URL.
 *
 * The original packs `"Specialty — Hospital (Quota)"` into one option string
 * and parses it back with a regex. Kept, because it is also what a shared URL
 * carries — but parsing is total here: a hospital containing a bracket, or a
 * quota containing an em dash, returns null rather than a silently wrong row.
 */
export function comboLabel(row: {
  specialty: string;
  hospital: string;
  quota: string;
}): string {
  return `${row.specialty} — ${row.hospital} (${row.quota})`;
}

export function parseComboLabel(
  label: string
): { specialty: string; hospital: string; quota: string } | null {
  const match = label.match(/^(.+?)\s*—\s*(.+)\s*\((.+?)\)$/);
  if (!match) return null;
  const [, specialty, hospital, quota] = match;
  return {
    specialty: specialty.trim(),
    hospital: hospital.trim(),
    quota: quota.trim(),
  };
}

/** Every combination available under one programme, sorted for the dropdown. */
export function comboOptions(rows: MeritRow[], program: string): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.program !== program) continue;
    seen.add(comboLabel(row));
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

export function findCombo(
  rows: MeritRow[],
  program: string,
  label: string
): MeritRow | null {
  const parsed = parseComboLabel(label);
  if (!parsed) return null;
  return (
    rows.find(
      (r) =>
        r.program === program &&
        r.specialty === parsed.specialty &&
        r.hospital === parsed.hospital &&
        r.quota === parsed.quota
    ) ?? null
  );
}

/**
 * Closing merit as a percentage of the max, in the most recent cycle that ran.
 *
 * Read from `yearly_pct_of_max` at `latest_induction` rather than dividing
 * `latest_merit` by the current policy's total: the latest cycle for a given
 * seat is not always the latest cycle overall, and dividing by the wrong
 * denominator inflates or deflates the figure without any sign that it has.
 */
export function latestPctOfMax(row: MeritRow): number | null {
  const direct = row.yearly_pct_of_max?.[String(row.latest_induction)];
  if (typeof direct === "number") return direct;

  const inductions = Object.keys(row.yearly_pct_of_max ?? {})
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a);

  for (const induction of inductions) {
    const value = row.yearly_pct_of_max[String(induction)];
    if (typeof value === "number") return value;
  }
  return null;
}

/**
 * Spread of closing merit, on the NORMALISED scale.
 *
 * The source carries `stddev`, and the original prints it directly. It is the
 * standard deviation of raw marks across cycles whose totals were 95, 60, 35
 * and 30 — so most of what it measures is the scoring policy being rewritten,
 * not the seat becoming less predictable. A seat that closed at exactly 80% of
 * the max every single cycle scores a large "deviation" there.
 *
 * Recomputed over `yearly_pct_of_max`, where the number means what the row
 * label says it means. Null below two observations: one point has no spread,
 * and printing 0.00 would read as "perfectly stable".
 */
export function normalisedStddev(row: MeritRow): number | null {
  const values = Object.values(row.yearly_pct_of_max ?? {}).filter(
    (v): v is number => typeof v === "number"
  );
  if (values.length < 2) return null;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * How a cell should be rendered.
 *
 * The matrix carries the SHAPE of each value, not markup — the original built
 * HTML strings inside the metric functions, which is what made its trend and
 * confidence cells impossible to reuse anywhere else.
 */
export type CompareCell =
  | { kind: "text"; value: string }
  | { kind: "number"; value: number | null; suffix?: string; digits: number }
  | { kind: "trend"; row: MeritRow }
  | { kind: "volatility"; row: MeritRow }
  | { kind: "confidence"; row: MeritRow };

export type CompareMetric = {
  label: string;
  /** Shown on the row label's `title` where the metric needs qualifying. */
  hint?: string;
  cells: CompareCell[];
};

export type CompareCycle = {
  induction: number;
  /** Year and induction, e.g. "2026 (Ind 21)". */
  label: string;
};

export type Comparison = {
  columns: MeritRow[];
  metrics: CompareMetric[];
};

/**
 * The comparison matrix.
 *
 * `cycles` arrives ascending and only its last `HISTORY_CYCLES` are given rows,
 * matching the original — older cycles ran under scoring policies two or three
 * revisions out of date, and thirteen pairs of rows buries the eight metrics
 * that actually summarise the seat.
 */
export function buildComparison(
  rows: MeritRow[],
  cycles: CompareCycle[]
): Comparison {
  const columns = rows.slice(0, MAX_COLUMNS);

  const metric = (
    label: string,
    fn: (row: MeritRow) => CompareCell,
    hint?: string
  ): CompareMetric => ({ label, hint, cells: columns.map(fn) });

  const metrics: CompareMetric[] = [
    metric("Avg Closing (% of Max)", (r) => ({
      kind: "number",
      value: r.avg_pct_of_max ?? null,
      suffix: "%",
      digits: 1,
    })),
    metric("Latest Closing (% of Max)", (r) => ({
      kind: "number",
      value: latestPctOfMax(r),
      suffix: "%",
      digits: 1,
    })),
    metric(
      "Latest Closing (Raw)",
      (r) => ({ kind: "number", value: r.latest_merit ?? null, digits: 2 }),
      "On that cycle's own marks total — not comparable across cycles."
    ),
    metric("Trend", (r) => ({ kind: "trend", row: r })),
    metric("Volatility", (r) => ({ kind: "volatility", row: r })),
    metric("Confidence", (r) => ({ kind: "confidence", row: r })),
    metric("Data Points", (r) => ({
      kind: "number",
      value: r.data_points ?? null,
      digits: 0,
    })),
    metric(
      "Std Deviation",
      (r) => ({ kind: "number", value: normalisedStddev(r), digits: 2 }),
      "Spread of closing merit as % of max. Computed on the normalised scale, so it measures the seat rather than the scoring policy changing."
    ),
  ];

  for (const cycle of cycles.slice(-HISTORY_CYCLES)) {
    const key = String(cycle.induction);
    metrics.push(
      metric(`${cycle.label} Cutoff`, (r) => ({
        kind: "number",
        value: r.yearly_merit?.[key] ?? null,
        digits: 2,
      })),
      metric(`${cycle.label} Seats`, (r) => ({
        kind: "number",
        value: r.yearly_seats?.[key] ?? null,
        digits: 0,
      }))
    );
  }

  return { columns, metrics };
}
