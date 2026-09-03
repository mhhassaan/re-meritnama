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
 * It does not need an *enclosure*.
 *
 * ## Why the seam is drawn by the cells, not by the container
 *
 * The obvious construction is `gap-px` with `bg-border` on the container, so
 * the colour shows only through the seams. That is what this was, and it has a
 * bug that only appears when the item count does not fill the last row: the
 * empty cells are still inside the container's box, so the border colour paints
 * them as a large solid block. On `/app/start` that was three quarters of a row
 * under "What each main area is for", and again under the induction cycles —
 * a slab of border colour where a reader expects the page.
 *
 * Filling the gap with placeholder cells cannot work either, because the number
 * needed changes with the column count and the column count is a media query.
 *
 * So each cell draws its own top and left hairline and is pulled back by a
 * pixel, which collapses adjacent borders into one line. Cells that do not
 * exist draw nothing, so an incomplete row is simply empty. The overhanging
 * rule on the first row and first column is trimmed by the container.
 *
 * `overflow-clip`, not `overflow-hidden`: `hidden` creates a scroll container
 * and `position: sticky` inside one sticks to that rather than to the viewport.
 * Nothing in these grids is sticky today, and this is not the place to leave
 * that trap lying.
 *
 * Two rules still hold for anything written by hand:
 *
 * - **Every cell must be opaque.** `HairlineCard` paints `bg-background`; a
 *   cell written by hand must do the same, or a card behind it shows through.
 * - **Hover is a fill, never a border.** A border that appears on hover puts
 *   back exactly the box this removes, and shifts nothing else on the row, so
 *   it reads as a flicker rather than as feedback.
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
  return (
    <div className={`grid overflow-clip ${className}`}>{children}</div>
  );
}

/**
 * One cell. Opaque by necessity, and carrying the two hairlines that become the
 * grid's seams — see the note above for why they live here rather than on the
 * container. Padding is the call site's, which is the only thing that knows how
 * much room its content wants.
 *
 * A cell that cannot use this component — a list needing real `<li>` elements,
 * or a card that is already its own component — repeats the same four classes
 * inline: `-ml-px -mt-px border-l border-t border-border` over an opaque fill.
 */
export function HairlineCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`-ml-px -mt-px border-l border-t border-border bg-background ${className}`}
    >
      {children}
    </div>
  );
}

