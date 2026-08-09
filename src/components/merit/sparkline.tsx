import type { MeritRow, MeritScale } from "@/lib/merit/types";
import { valueFor } from "@/lib/merit/query";

/**
 * Closing merit across cycles, as a small inline shape.
 *
 * Always drawn on the NORMALISED series regardless of the table's scale toggle.
 * Plotting raw values would draw a cliff between induction 16 and 17 that is
 * purely the total marks changing from 95 to 60 — a shape that looks like
 * collapsing competition and means nothing of the sort.
 *
 * Gaps are breaks in the line, not zeroes: a cycle a seat did not run in is
 * absent, and connecting across it would invent a trend.
 */
export function Sparkline({
  row,
  inductions,
  width = 84,
  height = 22,
  className = "",
}: {
  row: MeritRow;
  inductions: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const points = inductions.map((induction) => ({
    induction,
    value: valueFor(row, induction, "normalised" satisfies MeritScale),
  }));

  const present = points.filter((p) => p.value != null) as {
    induction: number;
    value: number;
  }[];

  if (present.length < 2) {
    return (
      <span className={`font-mono text-[10px] text-fg-subtle ${className}`}>
        —
      </span>
    );
  }

  // Fixed 0–100 domain rather than min/max of this row: an auto-scaled axis
  // makes a seat that moved 61%→63% look as dramatic as one that moved 20%→80%.
  const x = (i: number) => (i / (inductions.length - 1)) * width;
  const y = (v: number) => height - (v / 100) * height;

  // Split into contiguous runs so missing cycles break the line.
  const runs: string[] = [];
  let current: string[] = [];
  inductions.forEach((induction, i) => {
    const value = row.yearly_pct_of_max?.[String(induction)];
    if (typeof value === "number") {
      current.push(`${x(i).toFixed(1)},${y(value).toFixed(1)}`);
    } else if (current.length) {
      runs.push(current.join(" "));
      current = [];
    }
  });
  if (current.length) runs.push(current.join(" "));

  const last = present[present.length - 1];
  const lastIndex = inductions.indexOf(last.induction);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`overflow-visible ${className}`}
      // Decorative: every value it encodes is already in the table cells beside
      // it, so announcing it again would be noise.
      aria-hidden
      focusable="false"
    >
      {runs.map((run, i) => (
        <polyline
          key={i}
          points={run}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          // Single-point runs would be invisible without a cap.
          className="text-accent"
        />
      ))}
      <circle
        cx={x(lastIndex)}
        cy={y(last.value)}
        r="2"
        className="fill-accent"
      />
    </svg>
  );
}
