"use client";

import { useMemo, useRef } from "react";
import type { ForwardRefExoticComponent, HTMLAttributes, RefAttributes } from "react";

/**
 * Wiring for an animated icon inside a control.
 *
 * **Anything clickable gets an animated icon** — buttons, submits, load-more,
 * toolbar actions, nav rows. Static icons stay for decoration and labelling: a
 * specialty marker beside a heading, an inline status glyph, an icon that only
 * names a section. Motion is what separates a control from ornament; a screen
 * whose icons never react reads as a picture of an interface.
 *
 * Two things about `@hugeicons-animated` make this hook necessary rather than
 * decorative sugar:
 *
 * - Each icon animates on hover of **its own element**, which is 14–18 pixels
 *   inside a control that is often several hundred wide. Left alone, the icon
 *   plays only when the pointer crosses the artwork itself, which reads as
 *   broken rather than subtle.
 * - Attaching a `ref` switches the component to parent control —
 *   `useIconAnimation` sets `isControlledRef` the moment the handle attaches —
 *   so the control drives the animation and its own hover is the trigger.
 *
 * `onFocus`/`onBlur` are included deliberately: without them the cue is
 * pointer-only, which makes it feedback for some people and decoration for
 * everyone else.
 *
 * `prefers-reduced-motion` is handled inside `use-icon-animation`, so no caller
 * guards it.
 *
 *     const { ref, handlers } = useActionIcon();
 *     <button {...handlers}>Apply <FilterIcon ref={ref} size={16} /></button>
 *
 * The icons render a **`<div>`**, so never place one inside a `<span>` or a
 * `<p>` — invalid HTML, and it fails hydration.
 */

export type IconHandle = {
  startAnimation: () => void;
  stopAnimation: () => void;
};

export type AnimatedIcon = ForwardRefExoticComponent<
  HTMLAttributes<HTMLDivElement> & { size?: number } & RefAttributes<IconHandle>
>;

/**
 * Icon box, in pixels.
 *
 * Every one of these icons is drawn on a 24×24 viewBox and rendered square, so
 * one number keeps a column of them aligned — which is the other half of why
 * the navigation uses this set. Koboyo's per-icon viewBoxes are right for its
 * hand-drawn look and wrong for a list: a wide icon pushes its label further
 * right than a narrow one.
 */
export const ICON_SIZE = 18;

/** The same box at the size buttons use, where the icon sits beside a label. */
export const ICON_SIZE_SM = 16;

export function useActionIcon() {
  const ref = useRef<IconHandle>(null);

  const handlers = useMemo(
    () => ({
      onMouseEnter: () => ref.current?.startAnimation(),
      onMouseLeave: () => ref.current?.stopAnimation(),
      onFocus: () => ref.current?.startAnimation(),
      onBlur: () => ref.current?.stopAnimation(),
    }),
    []
  );

  return { ref, handlers };
}
