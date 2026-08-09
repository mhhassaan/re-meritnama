import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { Confidence, Trend } from "@/lib/merit/types";
import { familyOf, FAMILY_CLASSES, FAMILY_LABELS } from "@/lib/design/specialty";

/**
 * Trend indicator.
 *
 * A rising closing merit means the seat got HARDER to get, which is the
 * opposite of what a green upward arrow usually signals. The label carries the
 * meaning and the colour follows it, rather than defaulting to
 * green-up / red-down.
 */
export function TrendBadge({ trend }: { trend: Trend }) {
  const config = {
    rising: {
      Icon: TrendingUp,
      label: "Rising",
      hint: "harder to get",
      className: "text-status-reach",
    },
    falling: {
      Icon: TrendingDown,
      label: "Falling",
      hint: "easier to get",
      className: "text-status-safe",
    },
    stable: {
      Icon: Minus,
      label: "Stable",
      hint: "little change",
      className: "text-fg-muted",
    },
  }[trend] ?? {
    Icon: Minus,
    label: "Unknown",
    hint: "",
    className: "text-fg-subtle",
  };

  const { Icon, label, hint, className } = config;

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold ${className}`}
      // Spelled out for screen readers: an arrow alone does not say which
      // direction is good news.
      title={hint ? `${label} — ${hint}` : label}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}

/**
 * Confidence, derived from how many cycles of data exist.
 *
 * Shown everywhere a projection is, because the honest answer to "what will
 * this close at" depends heavily on whether there are eleven years of history
 * or two.
 */
export function ConfidenceBadge({
  confidence,
  dataPoints,
}: {
  confidence: Confidence;
  dataPoints?: number;
}) {
  const className =
    {
      high: "border-status-safe/50 text-status-safe",
      medium: "border-status-reach/50 text-status-reach",
      low: "border-border-strong text-fg-subtle",
    }[confidence] ?? "border-border-strong text-fg-subtle";

  return (
    <span
      className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${className}`}
      title={
        dataPoints != null
          ? `${confidence} confidence — based on ${dataPoints} cycle${dataPoints === 1 ? "" : "s"} of data`
          : `${confidence} confidence`
      }
    >
      {confidence}
    </span>
  );
}

/**
 * Specialty, coloured by discipline family.
 *
 * Colour carries the family, never the individual specialty — 44 distinct hues
 * could not stay accessible or distinguishable. The name does the precise
 * identification; the colour groups.
 */
export function SpecialtyLabel({
  specialty,
  className = "",
}: {
  specialty: string;
  className?: string;
}) {
  const family = familyOf(specialty);
  const classes = FAMILY_CLASSES[family];

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        aria-hidden
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${classes.bg}`}
      />
      <span className="min-w-0 truncate font-sans font-bold text-foreground">
        {specialty}
      </span>
      <span className="sr-only">({FAMILY_LABELS[family]})</span>
    </span>
  );
}
