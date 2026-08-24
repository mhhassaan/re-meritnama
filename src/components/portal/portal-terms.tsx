import type { ReactNode } from "react";

/**
 * Inline term highlighting for the portal's explanatory copy.
 *
 * The live Overview colours its vocabulary in place — Accepted green, Excluded
 * red, Awaited amber — and the colour is not decoration. Those three words name
 * the three consent states a reader is about to meet on every slot card, and a
 * paragraph that shows them in the colours they will appear in is doing part of
 * the teaching. The same applies to the queue tags and the candidate pills.
 *
 * Tones map to the semantic status tokens rather than to fresh colours, so they
 * flip with the theme and stay in step with every other status surface in the
 * app: safe for something kept, danger for something lost, reach for something
 * unresolved.
 */

export type TermTone = "safe" | "danger" | "reach" | "accent" | "plain";

const TONE_CLASS: Record<TermTone, string> = {
  safe: "text-status-safe",
  danger: "text-status-danger",
  reach: "text-status-reach",
  accent: "text-accent",
  // Weight alone, for a term that names a control rather than a state.
  plain: "text-foreground",
};

/** A term highlighted in running text. */
export function Term({
  children,
  tone = "plain",
}: {
  children: ReactNode;
  tone?: TermTone;
}) {
  return <span className={`font-bold ${TONE_CLASS[tone]}`}>{children}</span>;
}

/**
 * A candidate tag, drawn as the pill it appears as on a slot card.
 *
 * Rendered rather than described: the reader is being told what a badge looks
 * like, and showing the badge is shorter and less ambiguous than naming its
 * colour.
 */
export function Pill({
  children,
  tone = "plain",
}: {
  children: ReactNode;
  tone?: TermTone;
}) {
  const border: Record<TermTone, string> = {
    safe: "border-status-safe/50 text-status-safe",
    danger: "border-status-danger/50 text-status-danger",
    reach: "border-status-reach/50 text-status-reach",
    accent: "border-accent/50 text-accent",
    plain: "border-border-strong text-fg-muted",
  };

  return (
    <span
      // `whitespace-nowrap`: a two-word tag wrapping mid-pill reads as two
      // damaged badges rather than one.
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-sm border px-1.5 py-px font-mono text-[9px] font-bold uppercase tracking-wider ${border[tone]}`}
    >
      {children}
    </span>
  );
}
