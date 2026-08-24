"use client";

import { useEffect, useRef, useState } from "react";
import { PORTAL_QUOTES } from "@/lib/portal/quotes";

/**
 * The portal's rotating quote strip.
 *
 * Replaces the app's daily verse inside `/app/portal` only — see
 * `@/lib/portal/quotes` for why the register changes here.
 *
 * Rotates every 7 seconds, as the original does, and the dots jump straight to
 * a quote. Two things the original does not do:
 *
 * - **It stops when the tab is hidden and when the pointer is over it.** A
 *   timer that keeps firing in a background tab burns battery to change text
 *   nobody is reading, and one that advances mid-sentence while someone is
 *   reading is worse than no rotation.
 * - **It respects `prefers-reduced-motion`.** Rotation is a moving element in
 *   the corner of the eye; for a reader who has asked for less of that, the
 *   strip holds one quote and the dots still work.
 *
 * The first quote is chosen on the client after mount rather than at random
 * during render — a random pick during SSR gives the server and the client
 * different text and fails hydration.
 *
 * ## The strip does not change height when the quote does
 *
 * The paragraph carries a `min-h-[4.875em]` — three lines at `leading-relaxed`
 * (1.625), in `em` so it scales with both the mobile and the `sm:` font size
 * without two separate breakpoint values. Three, not two: the longest quote in
 * `PORTAL_QUOTES` (149 characters) was measured wrapping to three lines at the
 * narrowest width the row layout still applies (`sm`, 640px), so reserving
 * only two would still let that one push the page down.
 *
 * That measurement is also why the dot row below carries a `max-w` and
 * scrolls rather than growing without bound: thirty-two fixed-width dots ate
 * over half the row at 640–1024px, squeezing the same quote to as many as
 * five lines. Capped, the squeeze stops getting worse as more quotes are
 * added later — the three-line reservation stays correct rather than needing
 * to be revisited.
 */

const INTERVAL_MS = 7000;
const FADE_MS = 400;

export function PortalQuoteStrip({ className = "" }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useRef(false);

  // Random start, after mount. Doing it during render would mean the server
  // sent one quote and the client rendered another.
  useEffect(() => {
    reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setIndex(Math.floor(Math.random() * PORTAL_QUOTES.length));
  }, []);

  const goTo = (next: number) => {
    if (next === index) return;
    if (reduceMotion.current) {
      setIndex(next);
      return;
    }
    setFading(true);
    window.setTimeout(() => {
      setIndex(next);
      setFading(false);
    }, FADE_MS);
  };

  useEffect(() => {
    if (paused || reduceMotion.current) return;

    const tick = () => {
      // Nothing to see in a hidden tab, and nothing worth spending a frame on.
      if (document.hidden) return;
      setFading(true);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % PORTAL_QUOTES.length);
        setFading(false);
      }, FADE_MS);
    };

    const timer = window.setInterval(tick, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [paused]);

  const quote = PORTAL_QUOTES[index];

  return (
    <aside
      aria-label="Quotations"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className={`border-b border-border bg-surface-sunken px-4 py-3.5 sm:py-5 ${className}`}
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        {/* The height reservation lives on this wrapper, not on the `<p>`.
            Making the paragraph itself `flex` would hand its inline content —
            the quote text and the trailing author `<span>` — to flexbox's
            item layout instead of normal text flow, which does not reflow
            across lines the way a block does. The `<p>` stays a plain block
            so wrapping keeps working; the wrapper only centers it inside the
            reserved space when a quote is short enough to leave room. */}
        <div className="flex min-h-[4.875em] min-w-0 flex-1 items-center justify-center sm:justify-start">
          {/* `aria-live="off"`: a screen reader being interrupted every seven
              seconds by a decorative quotation would be hostile. The text is
              still readable on demand. */}
          <p
            aria-live="off"
            className={`text-center font-serif text-xs italic leading-relaxed text-fg-muted transition-opacity duration-[400ms] sm:text-left sm:text-[15px] ${
              fading ? "opacity-0" : "opacity-100"
            }`}
          >
            &ldquo;{quote.text}&rdquo;
            <span className="ml-2 whitespace-nowrap font-mono text-[10px] not-italic uppercase tracking-[0.14em] text-hope sm:text-[11px]">
              — {quote.author}
            </span>
          </p>
        </div>

        {/* Dots. Hidden below `sm`: thirty of them on a phone is a smear
            rather than a control, and the strip still rotates.
            `max-w-[30%]` + `overflow-x-auto` above `sm`: uncapped, thirty-two
            fixed-width dots ate over half the row at 640–1024px and squeezed
            the longest quote to five lines — this is what kept the reserved
            height above from having to cover that. The themed scrollbar from
            `globals.css` applies here for free. */}
        <div className="hidden max-w-[30%] shrink-0 items-center gap-1 overflow-x-auto sm:flex">
          {PORTAL_QUOTES.map((q, i) => (
            <button
              key={q.text}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Quotation ${i + 1} of ${PORTAL_QUOTES.length}`}
              aria-current={i === index}
              className={`h-1.5 rounded-full transition-all duration-[250ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                i === index
                  ? "w-4 bg-hope"
                  : "w-1.5 bg-border-strong hover:bg-fg-subtle"
              }`}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
