"use client";

import type { Prediction } from "@/lib/predict/predict";
import { SpecialtyLabel } from "@/components/merit/merit-badges";

/**
 * One seat combination in a prediction result.
 *
 * The fields and their framing are the original's, unchanged: historical
 * average, your margin over it, the projected range with a trend arrow, and the
 * confidence. Only the presentation is ours.
 */
export function PredictionCard({ prediction }: { prediction: Prediction }) {
  const { row, delta, projection } = prediction;

  // Above average reads as good news, below as caution. `reach` is warm rather
  // than red throughout this product — a reach is aspirational, not an error.
  const deltaClass =
    delta >= 3
      ? "text-status-safe"
      : delta >= -5
        ? "text-status-target"
        : "text-status-reach";

  const arrow =
    projection?.trend === "rising"
      ? "↑"
      : projection?.trend === "falling"
        ? "↓"
        : "→";

  return (
    <li className="rounded-sm border border-border bg-surface p-3 transition-colors duration-[150ms] hover:border-border-strong">
      <SpecialtyLabel specialty={row.specialty} className="text-[13px]" />

      <p className="mt-1 truncate text-xs text-fg-muted" title={row.hospital}>
        {row.hospital}
      </p>
      <p className="font-mono text-[10px] uppercase tracking-wider text-fg-subtle">
        {row.program} · {row.quota}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
        <span className="text-fg-muted">
          Avg: <span className="text-foreground">{row.avg_pct_of_max.toFixed(1)}%</span>
        </span>

        <span className={`font-bold ${deltaClass}`}>
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(1)}%
        </span>

        {projection && (
          <span className="text-fg-muted">
            {arrow} {projection.low}–{projection.high}%
          </span>
        )}

        <span className="ml-auto text-fg-subtle">
          {row.confidence === "high"
            ? "High"
            : row.confidence === "medium"
              ? "Medium"
              : "Low"}
        </span>
      </div>
    </li>
  );
}
