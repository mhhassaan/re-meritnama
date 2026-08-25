"use client";

import type { ReactNode } from "react";

/**
 * The "this is being replaced" state for a filtered result list.
 *
 * A deliberate half-step rather than a skeleton. The previous result is still
 * on screen and still correct for the filter that produced it, so replacing it
 * with placeholder boxes throws away information the reader can use and makes
 * the page look like it reloaded — which is the thing this exists to stop.
 * Dimming says "being replaced" while leaving it readable.
 *
 * `aria-busy` carries the same fact to a screen reader, which gets nothing from
 * opacity. Pointer events go off so a row cannot be clicked in the moment
 * between the old list and the new one, where the click would land on whichever
 * arrived.
 *
 * Opacity and nothing else: it is composited, so a list of several hundred rows
 * dims without a layout pass.
 */
export function FilterPending({
  pending,
  children,
  className = "",
}: {
  pending: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-busy={pending || undefined}
      className={`transition-opacity duration-200 ${
        pending ? "pointer-events-none opacity-55" : "opacity-100"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * A one-word cue beside the result count.
 *
 * Reserves nothing and moves nothing: it replaces the count's own line only
 * while a change is in flight, so the row does not grow and push the list down
 * — the layout-shift trap the quote strip already cost this project once.
 */
export function UpdatingNote({ pending }: { pending: boolean }) {
  if (!pending) return null;

  return (
    <span
      aria-live="polite"
      className="ml-2 font-mono text-[10px] uppercase tracking-[0.14em] text-accent"
    >
      Updating…
    </span>
  );
}
