"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import { ComposedChart } from "@/components/charts/composed-chart";
import { Line } from "@/components/charts/line";
import { Grid } from "@/components/charts/grid";
import { YAxis } from "@/components/charts/y-axis";
import { ChartTooltip } from "@/components/charts/tooltip/chart-tooltip";
import type { Cycle } from "@/lib/merit/data";
import type { MeritRow } from "@/lib/merit/types";
import { seatsFor, valueFor } from "@/lib/merit/query";
import { specialtyColorVar } from "@/lib/design/specialty";
import { ConfidenceBadge, SpecialtyLabel, TrendBadge } from "./merit-badges";

/**
 * The detail panel for one seat combination, opened by clicking a row.
 *
 * Ports what the original site showed in its `openMeritSidebar` — the four
 * summary stats, the policy note, the per-cycle table with percentile and
 * seats, and the trend chart — with three deliberate differences:
 *
 * 1. **Cycles are labelled with both the induction number and the year.** The
 *    original labelled this column "Year" and printed the induction number in
 *    it, so it showed a "Year" of 8 or 11. Neither field alone identifies a
 *    cycle: 2021 ran inductions 9 and 10, 2025 ran 17, 18 and 19.
 *
 * 2. **Seats are not plotted.** The original drew them as bars on a second
 *    y-axis. The registry's `SeriesBar` takes no `yAxisId`, so bars here would
 *    land on the 0–100 percentage axis, where a 3-seat bar would read as 3%.
 *    Seats stay in the table, which is where an exact small integer belongs.
 *
 * 3. **The line breaks at gaps**, as the original's `spanGaps: false` did.
 */

const CYCLE_SPACING_MS = 86_400_000;

/**
 * Ordinal suffix. The original appended a flat "th", producing "43th" and
 * "2th"; 11–13 are the exception that makes the naive rule wrong.
 */
function ordinal(value: number): string {
  const n = Math.round(value);
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

type Point = {
  x: Date;
  induction: number;
  label: string;
  pct: number;
  percentile: number | null;
};

export function MeritDetail({
  row,
  cycles,
  onClose,
  className = "",
}: {
  row: MeritRow;
  cycles: Cycle[];
  onClose: () => void;
  className?: string;
}) {
  const ran = useMemo(
    () =>
      cycles.filter(
        (cycle) => valueFor(row, cycle.induction, "normalised") != null
      ),
    [row, cycles]
  );

  const points = useMemo<Point[]>(
    () =>
      ran.map((cycle) => ({
        x: new Date(cycle.induction * CYCLE_SPACING_MS),
        induction: cycle.induction,
        label: cycle.label,
        pct: valueFor(row, cycle.induction, "normalised") as number,
        percentile: row.yearly_percentile?.[String(cycle.induction)] ?? null,
      })),
    [row, ran]
  );

  const latest = ran[ran.length - 1];
  const stroke = specialtyColorVar(row.specialty);

  // The source carries `stddev`, but it is the spread of RAW marks across
  // cycles whose totals were 95, 60, 35 and 30 — most of that "spread" is the
  // policy changing, not the seat becoming less predictable. Recomputed on the
  // normalised scale, where the number means what the label claims.
  const spread = useMemo(() => {
    const values = points.map((p) => p.pct);
    if (values.length < 2) return null;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }, [points]);

  return (
    // Lifted rather than ambient: this panel has come forward in response to a
    // click, and the deeper shadow is what says so.
    <aside
      aria-label={`${row.specialty} at ${row.hospital}, detail`}
      className={`rounded-lg bg-surface-sunken/70 p-1 shadow-lifted ring-1 ring-border ${className}`}
    >
    <div className="overflow-hidden rounded-[0.25rem] bg-surface shadow-[inset_0_1px_0_var(--edge-highlight)]">
      <header className="flex items-start justify-between gap-4 border-b border-border p-5">
        <div className="min-w-0">
          <SpecialtyLabel specialty={row.specialty} className="text-base" />
          <p className="mt-1 text-sm leading-snug text-fg-muted">{row.hospital}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wider text-fg-subtle">
              {row.program} · {row.quota}
            </span>
            <TrendBadge trend={row.trend} />
            <ConfidenceBadge
              confidence={row.confidence}
              dataPoints={row.data_points}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close detail"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border-strong text-fg-muted transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-accent hover:text-foreground active:scale-[0.94]"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>

      <div className="grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-4">
        <Stat label="Avg (% max)" value={`${row.avg_pct_of_max.toFixed(1)}%`} />
        <Stat
          label={latest ? `Latest (${latest.label})` : "Latest"}
          value={
            latest
              ? `${(valueFor(row, latest.induction, "normalised") as number).toFixed(1)}%`
              : "—"
          }
        />
        <Stat label="Years data" value={String(row.data_points ?? ran.length)} />
        {/* Volatility is the spread around the average, and it is the reason two
            combinations with the same average are not equally predictable. */}
        <Stat
          label="Volatility"
          value={row.volatility.toUpperCase()}
          hint={spread != null ? `± ${spread.toFixed(1)} pts of max` : undefined}
        />
      </div>

      {latest?.totalMarks != null && (
        <p className="border-b border-border px-4 py-2.5 font-mono text-[11px] text-fg-muted">
          Policy for the latest cycle:{" "}
          <span className="text-foreground">{latest.policyLabel}</span> ·{" "}
          {latest.totalMarks} marks max
        </p>
      )}

      {points.length >= 2 && (
        <div className="border-b border-border p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">
            Year-by-year closing merit
          </p>

          <ComposedChart
            data={points as unknown as Record<string, unknown>[]}
            xDataKey="x"
            aspectRatio="5 / 2"
            margin={{ top: 16, right: 12, bottom: 28, left: 34 }}
          >
            <Grid horizontal rowTickValues={[0, 25, 50, 75, 100]} />
            <YAxis numTicks={5} formatValue={(v) => `${v}%`} />

            <Line
              dataKey="pct"
              stroke={stroke}
              strokeWidth={2}
              showMarkers
              fadeEdges={false}
            />
            {/* Percentile shares the 0–100 axis honestly: both are percentages.
                Dashed so it reads as the secondary series. */}
            <Line
              dataKey="percentile"
              stroke="var(--chart-line-secondary)"
              strokeWidth={1.5}
              dashArray="4,3"
              dashFromIndex={0}
              showMarkers={false}
              fadeEdges={false}
            />

            <ChartTooltip
              showDatePill={false}
              content={({ point }) => {
                const p = point as unknown as Point;
                return (
                  <div className="px-2.5 py-1.5">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-chart-tooltip-muted">
                      {p.label}
                    </p>
                    <p className="mt-0.5 font-mono text-sm font-bold text-chart-tooltip-foreground">
                      {p.pct.toFixed(1)}% of max
                    </p>
                    <p className="font-mono text-[11px] text-chart-tooltip-muted">
                      {p.percentile != null
                        ? `${ordinal(p.percentile)} percentile`
                        : "percentile unavailable"}
                    </p>
                  </div>
                );
              }}
            />
          </ComposedChart>

          <div className="mt-1 flex flex-wrap items-center gap-4 font-mono text-[10px] text-fg-subtle">
            <Key color={stroke} label="Closing merit, % of max" />
            <Key color="var(--chart-line-secondary)" label="Percentile" dashed />
          </div>
        </div>
      )}

      <div className="overflow-x-auto p-4">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Closing merit by cycle for {row.specialty} at {row.hospital}
          </caption>
          <thead>
            <tr className="border-b border-border">
              <Th className="text-left">Year</Th>
              <Th className="text-right">Closing merit</Th>
              <Th className="text-right">% of max</Th>
              <Th className="text-right">Percentile</Th>
              <Th className="text-right">Seats</Th>
            </tr>
          </thead>
          <tbody>
            {ran.map((cycle) => {
              const raw = valueFor(row, cycle.induction, "raw");
              const pct = valueFor(row, cycle.induction, "normalised");
              const percentile =
                row.yearly_percentile?.[String(cycle.induction)] ?? null;
              const seats = seatsFor(row, cycle.induction);

              return (
                <tr key={cycle.induction} className="border-b border-border/60">
                  <td
                    className="py-2 pr-3 font-mono text-xs text-foreground"
                    // Two cycles share several of these years; the full policy
                    // label distinguishes them on hover without printing an
                    // induction number in the column.
                    title={cycle.policyLabel ?? undefined}
                  >
                    {cycle.label}
                  </td>
                  {/* The raw mark is meaningless without the total it was out
                      of, so the two are never separated. */}
                  <td className="py-2 text-right font-mono text-xs tabular-nums text-foreground">
                    {raw != null ? raw.toFixed(2) : "—"}
                    {raw != null && cycle.totalMarks != null && (
                      <span className="text-fg-subtle"> / {cycle.totalMarks}</span>
                    )}
                  </td>
                  <td className="py-2 text-right font-mono text-xs font-bold tabular-nums text-foreground">
                    {pct != null ? `${pct.toFixed(1)}%` : "—"}
                  </td>
                  <td className="py-2 text-right font-mono text-xs tabular-nums text-fg-muted">
                    {percentile != null ? ordinal(percentile) : "—"}
                  </td>
                  <td className="py-2 text-right font-mono text-xs tabular-nums text-fg-muted">
                    {seats ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    </aside>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    // A column with the label pinned to the top and the value directly under
    // it. "Avg (% max)" and "Latest (2026)" wrap to two lines while "Years
    // data" and "Volatility" do not, so without a reserved two-line label box
    // the values sat at four different heights across the row.
    <div className="flex flex-col bg-surface p-3">
      <p className="min-h-[2.4em] font-mono text-[9px] uppercase leading-[1.2] tracking-[0.18em] text-fg-muted">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-bold leading-none tabular-nums text-foreground">
        {value}
      </p>
      {hint && (
        <p className="mt-1 font-mono text-[10px] leading-tight text-fg-subtle">
          {hint}
        </p>
      )}
    </div>
  );
}

function Key({
  color,
  label,
  dashed = false,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block h-0 w-5"
        style={{
          borderTop: `2px ${dashed ? "dashed" : "solid"} ${color}`,
        }}
        aria-hidden
      />
      {label}
    </span>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-fg-muted ${className}`}
    >
      {children}
    </th>
  );
}
