"use client";

import { useLinkStatus } from "next/link";

/**
 * A pending cue on the nav row you just clicked.
 *
 * `useLinkStatus` only reports while its own `<Link>` is navigating, so this has
 * to be rendered *inside* the link. That constraint is also what makes it the
 * right control here: it fires on a real route change and on nothing else —
 * never on a filter change, which is deliberately dimmed in place instead.
 *
 * The bar sits under the row and grows from the left, so the direction matches
 * the skeleton sweep on the page arriving. It is a `scaleX` on a composited
 * layer rather than an animated width, and it never completes on its own: it
 * eases toward the far edge and is removed when the navigation resolves, which
 * is honest about not knowing how long the read will take. A bar that reaches
 * 100% and sits there is a promise it cannot keep.
 *
 * Hidden from assistive technology. The destination page announces its own
 * loading state through `role="status"` on the skeleton; two announcements for
 * one navigation is noise.
 */
export function NavPending() {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-3 bottom-0 h-px overflow-hidden rounded-full"
    >
      <span className="block h-full w-full origin-left bg-accent motion-safe:animate-[navPending_1.4s_cubic-bezier(0.32,0.72,0,1)_forwards] motion-reduce:opacity-60" />
    </span>
  );
}
