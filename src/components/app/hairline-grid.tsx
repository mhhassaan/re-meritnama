import type { ReactNode } from "react";

/**
 * A grid whose cells are separated by rules rather than boxed individually.
 *
 * The owner's standing direction is that only what genuinely needs a box on a
 * page gets one, and a repeated grid of cards is where that goes wrong fastest:
 * six bordered cards is twenty-four edges, and the page reads as a container of
 * containers rather than as content.
 *
 * A cell in a grid still needs a *boundary* — you have to be able to see where
 * one entry stops and the next begins, especially when each is a link target.
 * It does not need an *enclosure*. This paints `--border` on the container and
 * leaves 1px gaps between opaque cells, so the only place the colour shows
 * through is the seams. Six borders become five rules, and there is no outer
 * ring at all, because the cells cover every edge of the container.
 *
 * Two things follow from how it works, and both matter:
 *
 * - **Every cell must be opaque**, or the container's border colour shows
 *   through the cell itself and the whole grid tints. `HairlineCard` paints
 *   `bg-background`; a cell written by hand must do the same.
 * - **Hover is a fill, never a border.** A border that appears on hover puts
 *   back exactly the box this removes, and it also shifts nothing else on the
 *   row, so the change reads as a flicker rather than as feedback.
 *
 * Column counts belong on the call site — `md:grid-cols-2 xl:grid-cols-3` —
 * because they are about that page's content, not about this pattern.
 */
export function HairlineGrid({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`grid gap-px bg-border ${className}`}>{children}</div>;
}

/**
 * One cell. Opaque by necessity — see above — and padded by the call site,
 * which is the only thing that knows how much room its content wants.
 */
export function HairlineCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`bg-background ${className}`}>{children}</div>;
}
