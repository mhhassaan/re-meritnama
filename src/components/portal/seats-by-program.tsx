/**
 * Seats by programme.
 *
 * The live portal draws this as a five-bar column chart. It is rendered here as
 * a proportional bar list instead, for two reasons rather than preference:
 * five programmes are ordinal, and the chart components in this project are
 * time-series — `LineChart` coerces x with `new Date()` and has no ordinal
 * mode, which is the same trap the merit trend chart already works around. And
 * five labelled quantities read better as rows than as columns, because the
 * names ("FCPS Dentistry") do not fit under a bar.
 *
 * This is not a hand-rolled chart: there is no axis, no scale and no
 * interaction. It is a table with the number drawn as well as written.
 *
 * Colour comes from the sequential chart scale rather than the specialty family
 * palette. `familyOf()` classifies SPECIALTIES, and every programme name falls
 * through to the same default family — so the first version drew five
 * identically-coloured bars. The scale runs light-to-dark on a light ground and
 * the reverse on a dark one, which is what it exists for.
 */

/** Darkest first, so the largest programme reads as the heaviest. */
const SCALE = [
  "var(--chart-scale-05)",
  "var(--chart-scale-04)",
  "var(--chart-scale-03)",
  "var(--chart-scale-02)",
  "var(--chart-scale-01)",
];
export function SeatsByProgram({
  data,
  noun = "seats",
}: {
  data: Array<{ program: string; seats: number }>;
  /**
   * What the quantity IS.
   *
   * The Candidate Pool reuses this list to count applicants per programme, and
   * the first version left the hardcoded word in place — so 2,279 people were
   * labelled "2,279 seats", which is a different and much larger claim than
   * the page was making.
   */
  noun?: string;
}) {
  const total = data.reduce((sum, d) => sum + d.seats, 0);
  const largest = Math.max(...data.map((d) => d.seats), 1);

  return (
    <ul className="flex flex-col gap-4">
      {data.map(({ program, seats }, i) => {
        // Width is relative to the LARGEST programme, not the total: with FCPS
        // at 55% of all seats, scaling by total leaves the other four as
        // slivers and the comparison unreadable.
        const width = (seats / largest) * 100;
        const share = total ? (seats / total) * 100 : 0;

        return (
          <li key={program}>
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-sans text-sm font-bold text-foreground">
                {program}
              </span>
              <span className="font-mono text-xs tabular-nums text-fg-muted">
                <span className="font-bold text-foreground">
                  {seats.toLocaleString("en-GB")}
                </span>{" "}
                {noun} · {share.toFixed(1)}%
              </span>
            </div>

            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-sm bg-surface-sunken">
              <div
                className="h-full rounded-sm transition-[width] duration-[600ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
                style={{
                  width: `${width}%`,
                  // Token, never a raw hex — the same rule the charts follow.
                  // Rows are already ordered by size, so the scale index is the
                  // row index and the ramp reads as the ranking.
                  background: SCALE[Math.min(i, SCALE.length - 1)],
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
