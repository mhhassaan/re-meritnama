"use client";

import { useMemo } from "react";
import { LineChart, Line } from "@/components/charts/line-chart";
import { Grid } from "@/components/charts/grid";
import type { MeritRow } from "@/lib/merit/types";
import { valueFor } from "@/lib/merit/query";
import { specialtyColorVar } from "@/lib/design/specialty";

/**
 * The in-row trend, shown in place of the per-cycle number cells while a table
 * row is hovered.
 *
 * This is a different component from `MeritTrendChart` (used in the mobile card
 * and given its own frame) because the constraints are different: it has to
 * occupy exactly the width of the induction columns, be readable at ~100 px
 * tall, and carry the numbers it replaced — the point of the swap is to show
 * the same values as a shape, not to hide them.
 *
 * Height is fixed in pixels rather than set by aspect ratio so the value labels
 * can be positioned from the same arithmetic the chart uses: the y domain is a
 * fixed 0–100, so `y = top + (1 - value / 100) * innerHeight`.
 */

const CYCLE_SPACING_MS = 86_400_000;

const HEIGHT = 104;
const MARGIN = { top: 20, right: 10, bottom: 16, left: 10 };
const INNER_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

type Point = { x: Date; induction: number; value: number };

export function MeritRowTrend({
  row,
  inductions,
}: {
  row: MeritRow;
  inductions: number[];
}) {
  const points = useMemo<Point[]>(
    () =>
      inductions
        .map((induction) => {
          // Always normalised. A raw line would render the marks total moving
          // from 95 to 30 as if it were a change in competitiveness.
          const value = valueFor(row, induction, "normalised");
          return value == null
            ? null
            : { x: new Date(induction * CYCLE_SPACING_MS), induction, value };
        })
        .filter((point): point is Point => point !== null),
    [row, inductions]
  );

  if (points.length < 2) {
    return (
      <div
        className="flex items-center justify-center font-mono text-[10px] text-fg-subtle"
        style={{ height: HEIGHT }}
      >
        {points.length === 1
          ? `Induction ${points[0].induction} only — ${points[0].value.toFixed(1)}%, not a trend`
          : "No cycle data"}
      </div>
    );
  }

  const stroke = specialtyColorVar(row.specialty);

  const first = points[0].x.getTime();
  const last = points[points.length - 1].x.getTime();
  const span = last - first || 1;

  // Horizontal position of a point, as a CSS length that tracks the container.
  const leftFor = (point: Point) => {
    const fraction = (point.x.getTime() - first) / span;
    return `calc(${MARGIN.left}px + ${fraction} * (100% - ${
      MARGIN.left + MARGIN.right
    }px))`;
  };

  return (
    <div className="relative" style={{ height: HEIGHT }}>
      <LineChart
        data={points as unknown as Record<string, unknown>[]}
        xDataKey="x"
        margin={MARGIN}
        // No aspectRatio: the chart fills this sized parent, which is what
        // makes the label arithmetic below exact.
        style={{ height: HEIGHT }}
        // Hovering a different row remounts this with new data; the enter
        // animation would replay on every pointer move across the table.
        animationDuration={0}
      >
        <Grid horizontal rowTickValues={[0, 50, 100]} />
        <Line
          dataKey="value"
          stroke={stroke}
          strokeWidth={2}
          showMarkers
          fadeEdges={false}
          animate={false}
        />
      </LineChart>

      {/* The numbers this chart replaced, kept on the points they belong to.
          Not a tooltip: all of them are readable at once, which is the whole
          reason the columns were worth swapping out. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {points.map((point) => (
          <span
            key={`v-${point.induction}`}
            className="absolute -translate-x-1/2 -translate-y-full font-mono text-[9px] font-bold tabular-nums text-foreground"
            style={{
              left: leftFor(point),
              // Clear of the marker itself, which is drawn at the point.
              top: MARGIN.top + (1 - point.value / 100) * INNER_HEIGHT - 9,
            }}
          >
            {point.value.toFixed(1)}
          </span>
        ))}

        {points.map((point) => (
          <span
            key={`i-${point.induction}`}
            className="absolute -translate-x-1/2 font-mono text-[9px] tabular-nums text-fg-subtle"
            style={{ left: leftFor(point), bottom: 0 }}
          >
            {point.induction}
          </span>
        ))}
      </div>

      {/* Screen readers get the series as text — the visual swap is a hover
          affordance they never receive. */}
      <span className="sr-only">
        Closing merit as a percentage of each cycle&apos;s total:{" "}
        {points
          .map((p) => `Induction ${p.induction}, ${p.value.toFixed(1)} percent`)
          .join("; ")}
      </span>
    </div>
  );
}
