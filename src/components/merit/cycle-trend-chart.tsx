"use client";

import { useMemo } from "react";
import { AreaChart } from "@/components/charts/area-chart";
import { Area } from "@/components/charts/area";
import { Grid } from "@/components/charts/grid";
import { YAxis } from "@/components/charts/y-axis";
import { ChartTooltip } from "@/components/charts/tooltip/chart-tooltip";
import type { CycleSummary } from "@/lib/merit/data";

/**
 * Average closing merit across every cycle on record.
 *
 * The aggregate view the original puts above its cycle cards: one point per
 * cycle, the mean of every seat's close that cycle, normalised so a 95-mark
 * cycle and a 30-mark cycle sit on the same axis.
 *
 * Same two constraints as every other chart here. The registry's x scale is a
 * time scale with no ordinal mode, so cycles map to evenly spaced synthetic
 * instants and the tick row below is ours. And a cycle with no closing merits
 * is dropped from the series rather than passed through as null, because the
 * series components coerce a non-numeric y to 0 — which would draw the current,
 * not-yet-run cycle as a collapse to zero.
 */

const CYCLE_SPACING_MS = 86_400_000;

type Point = {
  x: Date;
  induction: number;
  label: string;
  avg: number;
  entries: number;
};

export function CycleTrendChart({ cycles }: { cycles: CycleSummary[] }) {
  const points = useMemo<Point[]>(
    () =>
      cycles
        .filter((c) => c.avgPctOfMax != null)
        .map((c) => ({
          x: new Date(c.induction * CYCLE_SPACING_MS),
          induction: c.induction,
          label: c.label,
          avg: c.avgPctOfMax as number,
          entries: c.trackedEntries,
        })),
    [cycles]
  );

  if (points.length < 2) return null;

  const first = points[0].x.getTime();
  const last = points[points.length - 1].x.getTime();
  const span = last - first || 1;

  return (
    <div>
      <AreaChart
        data={points as unknown as Record<string, unknown>[]}
        xDataKey="x"
        aspectRatio="4 / 1"
        margin={{ top: 16, right: 12, bottom: 12, left: 38 }}
      >
        <Grid horizontal rowTickValues={[0, 25, 50, 75, 100]} />
        <YAxis numTicks={5} formatValue={(v) => `${v}%`} />

        <Area
          dataKey="avg"
          fill="var(--chart-line-primary)"
          fillOpacity={0.18}
          strokeWidth={2}
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
                  {p.avg.toFixed(1)}% of max
                </p>
                <p className="font-mono text-[11px] text-chart-tooltip-muted">
                  across {p.entries.toLocaleString("en-GB")} tracked seats
                </p>
              </div>
            );
          }}
        />
      </AreaChart>

      {/* Our tick row, matching the chart's own margins. */}
      <div className="relative mt-1 h-4" aria-hidden>
        {points.map((point) => {
          const fraction = (point.x.getTime() - first) / span;
          return (
            <span
              key={point.induction}
              className="absolute -translate-x-1/2 font-mono text-[9px] tabular-nums text-fg-subtle"
              style={{ left: `calc(38px + ${fraction} * (100% - 50px))` }}
            >
              {point.label}
            </span>
          );
        })}
      </div>

      <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-fg-subtle">
        Year · average closing merit, % of max
      </p>

      <p className="sr-only">
        {points
          .map((p) => `${p.label}: ${p.avg.toFixed(1)} percent of max`)
          .join("; ")}
      </p>
    </div>
  );
}
