"use client";

import { useMemo } from "react";
import { LineChart, Line } from "@/components/charts/line-chart";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip/chart-tooltip";
import { chartCssVars } from "@/components/charts/chart-context";
import type { MeritRow } from "@/lib/merit/types";
import { valueFor } from "@/lib/merit/query";
import { specialtyColorVar } from "@/lib/design/specialty";

/**
 * Closing merit across cycles, for one seat combination.
 *
 * Uses the `@bklit` LineChart. Three things about that component shape this
 * wrapper, and none of them are stylistic:
 *
 * 1. **Its x scale is a time scale.** It coerces the x value with `new Date()`
 *    and there is no ordinal mode. Induction cycles are not dates — two or
 *    three run per calendar year and the archives give no reliable month — so
 *    inventing a real date per cycle would fabricate precision the source does
 *    not have. Instead the induction NUMBER is mapped to a synthetic instant
 *    (`induction * DAY`). That keeps cycles evenly spaced and, more usefully,
 *    keeps a skipped cycle visible as a wider gap between points.
 *
 * 2. **Its axis labels come from an internal date formatter** with no prop to
 *    override them, so `XAxis` is deliberately not used. The tick row below is
 *    ours and prints real induction numbers.
 *
 * 3. **`Line` coerces a non-numeric y value to 0.** A cycle this combination
 *    did not run in would therefore be drawn as a plunge to 0%, inventing a
 *    catastrophic result that never happened. So gaps are dropped from the
 *    series entirely rather than passed through as null. The line then spans
 *    the gap, which is why markers are shown: every dot is a real observation,
 *    and anything between two dots is interpolation, not data.
 */

/** One day, in ms. An arbitrary unit — only the spacing between cycles matters. */
const CYCLE_SPACING_MS = 86_400_000;

type Point = {
  x: Date;
  induction: number;
  value: number;
};

export function MeritTrendChart({
  row,
  inductions,
  className = "",
  aspectRatio = "3 / 1",
}: {
  row: MeritRow;
  inductions: number[];
  className?: string;
  aspectRatio?: string;
}) {
  const points = useMemo<Point[]>(
    () =>
      inductions
        .map((induction) => {
          // Always normalised: raw marks come from cycles whose totals ranged
          // from 95 down to 30, so a raw line would plot a policy change as if
          // it were a change in competitiveness.
          const value = valueFor(row, induction, "normalised");
          return value == null
            ? null
            : {
                x: new Date(induction * CYCLE_SPACING_MS),
                induction,
                value,
              };
        })
        .filter((point): point is Point => point !== null),
    [row, inductions]
  );

  // One observation cannot be a trend. Drawing a single dot on a full chart
  // frame implies a series that does not exist.
  if (points.length < 2) {
    return (
      <p className={`font-mono text-[11px] text-fg-subtle ${className}`}>
        Only one cycle of data — not enough for a trend.
      </p>
    );
  }

  const stroke = specialtyColorVar(row.specialty);

  const first = points[0].x.getTime();
  const last = points[points.length - 1].x.getTime();
  const span = last - first || 1;

  return (
    <div className={className}>
      <LineChart
        data={points as unknown as Record<string, unknown>[]}
        xDataKey="x"
        aspectRatio={aspectRatio}
        // Tight margins: the registry ships no YAxis component, and our own
        // induction ticks sit outside the frame, so reserved gutters would be
        // empty space. Enough is kept for the end markers not to clip.
        margin={{ top: 12, right: 10, bottom: 12, left: 10 }}
      >
        <Grid horizontal rowTickValues={[0, 25, 50, 75, 100]} />

        <Line
          dataKey="value"
          stroke={stroke}
          strokeWidth={2}
          showMarkers
          fadeEdges={false}
        />

        <ChartTooltip
          // The date pill would print a formatted calendar date built from the
          // synthetic instant — meaningless here.
          showDatePill={false}
          indicatorColor={chartCssVars.crosshair}
          content={({ point }) => {
            const p = point as unknown as Point;
            return (
              <div className="px-2.5 py-1.5">
                <p className="font-mono text-[10px] uppercase tracking-wider text-chart-tooltip-muted">
                  Induction {p.induction}
                </p>
                <p className="mt-0.5 font-mono text-sm font-bold text-chart-tooltip-foreground">
                  {p.value.toFixed(1)}% of max
                </p>
              </div>
            );
          }}
        />
      </LineChart>

      {/* Our tick row. Positioned with the same margins the chart uses, so a
          label sits under its point at any container width. */}
      <div
        className="relative mt-1 h-4"
        aria-hidden
      >
        {points.map((point) => {
          const fraction = (point.x.getTime() - first) / span;
          return (
            <span
              key={point.induction}
              className="absolute -translate-x-1/2 font-mono text-[9px] text-fg-subtle"
              style={{
                left: `calc(10px + ${fraction} * (100% - 20px))`,
              }}
            >
              {point.induction}
            </span>
          );
        })}
      </div>

      <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-fg-subtle">
        {/* The vertical scale is stated rather than drawn: the registry's
            line-chart ships no YAxis, and gridlines with no labels are
            decoration. The domain is fixed 0–100 so two charts compare. */}
        Induction · % of max, 0–100 scale
      </p>
    </div>
  );
}
