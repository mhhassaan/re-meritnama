"use client";

import { useLinkStatus } from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

/**
 * Pending feedback for a landing-page link that goes into the app.
 *
 * ## Why the landing page needs its own
 *
 * The app has skeletons — `(app)/app/loading.tsx` and its siblings — but they
 * only appear once Next.js has begun rendering the destination segment. Coming
 * from `/`, that means loading a whole other layout first, and the `(app)`
 * shell awaits the session, the profile and the notices before it renders
 * anything at all. For the length of that, the browser stays on the landing
 * page with the old pixels and no cue that a click registered. On a page whose
 * destinations take seconds, that reads as a dead button.
 *
 * ## Why `useLinkStatus`, and what that forces
 *
 * It reports only while **its own** `<Link>` is navigating, which is exactly
 * the signal wanted — it cannot fire on a hash jump to `#explore-section` or on
 * a filter change. The cost is that it has to be rendered *inside* every link,
 * so this component is dropped into each one rather than mounted once.
 *
 * That per-link constraint is also why the page-wide bar is **portaled**: a
 * global cue cannot subscribe to a hook that only exists inside a link, so the
 * link that is actually pending paints it into `document.body` instead. Only
 * one link can be mid-navigation at a time, so they cannot stack.
 *
 * ## The two cues
 *
 * - A bar across the top of the viewport, which is the convention every reader
 *   already knows and the only cue visible if they have scrolled away from the
 *   thing they clicked.
 * - A local one on the control itself, so the answer to "did that register?" is
 *   where the pointer already is. `variant` picks which — a rule under a tile,
 *   or a spinner beside a button's label — and the position is part of the
 *   variant rather than something a call site passes in: an override would land
 *   on the same properties as the base and win or lose by stylesheet order
 *   rather than by intent.
 *
 * Both ease toward the far edge and stop short of it, like `NavPending` in the
 * app: the page does not know how long the read will take, and a bar that
 * reaches 100% and sits there is a promise it cannot keep.
 */
export function LinkPending({
  variant = "card",
}: {
  /**
   * `card` — a rule inset from the edges of a large tile.
   * `dot` — a spinner, for a control that already has an icon slot.
   */
  variant?: "card" | "dot";
}) {
  const { pending } = useLinkStatus();
  const [mounted, setMounted] = useState(false);

  // `createPortal` needs a document. Rendering nothing on the server also keeps
  // this out of the static HTML, which is right: nothing is pending on load.
  useEffect(() => setMounted(true), []);

  if (!pending) return null;

  return (
    <>
      {mounted &&
        createPortal(
          <span
            aria-hidden
            className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden bg-brand-teal/15"
          >
            <span className="block h-full w-full origin-left bg-brand-teal motion-safe:animate-[navPending_1.4s_cubic-bezier(0.32,0.72,0,1)_forwards] motion-reduce:opacity-70" />
          </span>,
          document.body
        )}

      {/* Announced once, politely: a reader using a screen reader gets no
          benefit from the bar and should still know the click took. */}
      <span role="status" className="sr-only">
        Loading…
      </span>

      {variant === "dot" ? (
        <span
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
        />
      ) : (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-6 bottom-3 h-px overflow-hidden rounded-full bg-brand-teal/20"
        >
          <span className="block h-full w-full origin-left bg-brand-teal motion-safe:animate-[navPending_1.4s_cubic-bezier(0.32,0.72,0,1)_forwards] motion-reduce:opacity-70" />
        </span>
      )}
    </>
  );
}
