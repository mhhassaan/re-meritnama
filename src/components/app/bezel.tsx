import type { ReactNode } from "react";

/**
 * A card: one surface, one hairline, no shadow.
 *
 * The point is that a panel should not sit flat on the page. A recessed outer
 * shell with its own hairline, holding an inner surface with a lit top edge,
 * reads as a machined object with real thickness — the same reason a physical
 * instrument panel has a bezel around its display.
 *
 * The inner radius is deliberately the outer radius minus the shell padding.
 * Concentric curves only look right when they are actually concentric; equal
 * radii make the inner corner look pinched.
 *
 * The radii are tight on purpose. The app runs on a `rounded-sm` / `rounded-md`
 * / `rounded-lg` scale set by the auth and marketing surfaces — a control-room
 * geometry, per DESIGN_GUIDELINES. Large squircles read as a different product.
 *
 * Colour comes entirely from tokens, so this flips with the theme. The lit edge
 * is `--edge-highlight`, which is a near-white lip on cream and a faint one on
 * midnight — a white highlight would glare on the dark ground.
 */
export function Bezel({
  children,
  className = "",
  innerClassName = "",
  lifted = false,
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  /** Deeper shadow, for something that has come forward — an opened panel. */
  lifted?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-border bg-surface ${
        lifted ? "shadow-ambient" : ""
      } ${className}`}
    >
      {/* 0.5rem minus the 1px border, so the inner corner stays concentric
          with the outer one for anything that paints its own background. */}
      <div className={`rounded-[calc(0.5rem-1px)] ${innerClassName}`}>
        {children}
      </div>
    </div>
  );
}

/**
 * The small uppercase pill that precedes a heading.
 *
 * Sized and tracked per DESIGN_GUIDELINES' pill-tag scale. It is a label, not a
 * button, so it is not focusable and carries no hover state.
 */
export function Eyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-mono text-[10px] font-bold uppercase leading-none tracking-[0.2em] text-accent ${className}`}
    >
      {children}
    </span>
  );
}
