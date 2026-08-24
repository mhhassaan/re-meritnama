import type { Band } from "@/lib/portal/pool-stats";

/**
 * A distribution, drawn as a proportional bar list.
 *
 * Not a hand-rolled chart: there is no axis, no scale and no interaction. It is
 * a table with the number drawn as well as written, the same shape
 * `SeatsByProgram` uses and for the same reason — the chart components in this
 * project are time-series, and `LineChart` coerces x with `new Date()`. Marks
 * bands are ordinal, so they hit that trap exactly as the merit trend chart
 * does.
 *
 * Width is relative to the tallest band rather than the total. With a
 * distribution this peaked, scaling by total leaves every band but one as a
 * sliver and the shape unreadable, which is the only thing anyone came here to
 * see.
 */

/** Darkest at the peak, so the mass of the distribution reads as the heaviest. */
const SCALE = [
  "var(--chart-scale-05)",
  "var(--chart-scale-04)",
  "var(--chart-scale-03)",
  "var(--chart-scale-02)",
  "var(--chart-scale-01)",
];

export function PoolBands({
  bands,
  total,
  unit = "applicants",
}: {
  bands: Band[];
  /** The pool, so each band can state its share of the whole. */
  total: number;
  unit?: string;
}) {
  const tallest = Math.max(...bands.map((b) => b.count), 1);

  return (
    <ul className="flex flex-col gap-2.5">
      {bands.map((band) => {
        const width = (band.count / tallest) * 100;
        const share = total ? (band.count / total) * 100 : 0;

        // Five steps of the scale, keyed to how tall the band is rather than to
        // its position in the list: the ramp then reads as density, which is
        // what the eye is looking for, instead of as a meaningless left-to-right
        // gradient.
        //
        // Index 0 is `--chart-scale-05`, the heaviest end, so the ratio is
        // inverted before it is used. The first version indexed straight and
        // gave the tallest band the lightest colour — the peak of the
        // distribution came out nearly invisible against its own track, which
        // is the one bar the whole section exists to show.
        const step = band.count
          ? SCALE.length -
            1 -
            Math.min(SCALE.length - 1, Math.floor((band.count / tallest) * SCALE.length))
          : SCALE.length - 1;

        return (
          <li key={band.label} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-right font-mono text-[11px] tabular-nums text-fg-muted">
              {band.label}
            </span>

            <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-surface-sunken">
              <div
                className="h-full rounded-sm transition-[width] duration-[600ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
                style={{
                  width: `${width}%`,
                  // Token, never a raw hex — the rule the charts follow.
                  background: SCALE[step],
                }}
              />
            </div>

            <span
              className="w-28 shrink-0 font-mono text-[11px] tabular-nums text-fg-muted"
              title={`${band.count.toLocaleString("en-GB")} ${unit}`}
            >
              <span className="font-bold text-foreground">
                {band.count.toLocaleString("en-GB")}
              </span>{" "}
              · {share.toFixed(1)}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}
