"use client";

import { useMemo, useState } from "react";

/**
 * Where a score falls in the distribution of historical closing merits.
 *
 * A histogram of every seat's average close, with the reader's position marked
 * and a hover readout per bar — the original's chart is hoverable and reports
 * the count, so a bar you cannot interrogate is a regression, not a
 * simplification.
 *
 * Hand-drawn rather than pulled from the chart registry: it is a static 20-bar
 * glyph with no axes and one interaction, the same reasoning that keeps
 * `sparkline.tsx` hand-rolled.
 *
 * Bins span the actual range of the data, not a fixed 0–100. Closing merits
 * cluster between roughly 30% and 90%, so fixed bins would waste a third of the
 * chart on empty space at both ends and flatten the shape that matters.
 */

const BIN_COUNT = 20;

export function ScoreDistribution({
  distribution,
  userPct,
  className = "",
}: {
  distribution: number[];
  userPct: number;
  className?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const { bins, min, step } = useMemo(() => {
    if (!distribution.length) {
      return { bins: [] as number[], min: 0, step: 1 };
    }

    const lo = Math.floor(Math.min(...distribution));
    const hi = Math.ceil(Math.max(...distribution));
    const width = (hi - lo) / BIN_COUNT || 1;

    const counts = new Array(BIN_COUNT).fill(0);
    for (const value of distribution) {
      const index = Math.min(
        BIN_COUNT - 1,
        Math.max(0, Math.floor((value - lo) / width))
      );
      counts[index]++;
    }

    return { bins: counts, min: lo, step: width };
  }, [distribution]);

  if (!bins.length) return null;

  const max = Math.max(...bins, 1);
  const userBin = Math.min(
    BIN_COUNT - 1,
    Math.max(0, Math.floor((userPct - min) / step))
  );

  const active = hovered ?? userBin;
  const activeLow = min + active * step;

  return (
    <div className={className}>
      {/* Reserved height, so the row appearing on hover does not shift the
          chart under the pointer. */}
      <p className="mb-1 h-4 font-mono text-[10px] text-fg-muted">
        {bins[active] > 0 || hovered != null ? (
          <>
            <span className="text-foreground">
              {activeLow.toFixed(0)}–{(activeLow + step).toFixed(0)}%
            </span>{" "}
            · {bins[active].toLocaleString("en-GB")} seat
            {bins[active] === 1 ? "" : "s"}
            {active === userBin && (
              <span className="text-accent"> · your score</span>
            )}
          </>
        ) : null}
      </p>

      <div className="flex h-24 items-end gap-[3px]">
        {bins.map((count, i) => {
          const low = min + i * step;
          return (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              onMouseEnter={() => setHovered(i)}
              onFocus={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onBlur={() => setHovered(null)}
              title={`${low.toFixed(0)}–${(low + step).toFixed(0)}% of max · ${count} seat${count === 1 ? "" : "s"}`}
              style={{ height: `${Math.max(2, (count / max) * 100)}%` }}
              className={`flex-1 cursor-default rounded-t-[2px] transition-colors duration-[150ms] ${
                i === userBin
                  ? "bg-accent"
                  : i === hovered
                    ? "bg-fg-muted"
                    : "bg-border-strong"
              }`}
            />
          );
        })}
      </div>

      <div className="mt-1.5 flex justify-between font-mono text-[9px] text-fg-subtle">
        <span>{min.toFixed(0)}%</span>
        <span>{(min + (step * BIN_COUNT) / 2).toFixed(0)}%</span>
        <span>{(min + step * BIN_COUNT).toFixed(0)}%</span>
      </div>

      <p className="sr-only">
        Your score of {userPct.toFixed(1)} percent of max, shown against the
        distribution of {distribution.length} historical average closing merits.
      </p>
    </div>
  );
}
