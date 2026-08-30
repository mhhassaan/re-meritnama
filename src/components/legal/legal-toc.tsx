"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The contents rail on the two legal pages.
 *
 * ## Where the section list comes from
 *
 * It is read out of the DOM after mount rather than passed in as a prop. The
 * headings are already on the page; duplicating them into an array beside the
 * prose would give the pages two copies of the same list, and the copy nobody
 * looks at is the one that goes stale. Reading the rendered document means the
 * rail cannot disagree with the page it is describing.
 *
 * The cost is that the rail is not in the server HTML. That is acceptable here
 * because it is `position: fixed` — it fades in beside the text and moves
 * nothing. The small-screen fallback below is a closed `<details>`, so filling
 * its list in after mount does not shift anything either.
 *
 * ## Which section is "current"
 *
 * Computed from scroll position rather than with `IntersectionObserver`: the
 * question is "which heading did I last pass", and an observer answers a
 * different question that goes wrong at the ends of a document — a final
 * section shorter than the viewport never becomes the most-visible one, so the
 * rail sticks on the second-to-last entry for the whole tail of the page. The
 * scan runs inside `requestAnimationFrame` on a passive listener.
 *
 * ## Hover is not the only way in
 *
 * Labels appear on hover of the rail **and** on focus of any item within it,
 * for the same reason the icon animations wire `onFocus` alongside
 * `onMouseEnter`: a pointer-only affordance is feedback for some people and
 * decoration for everyone else. Every entry is a real anchor, so the rail works
 * with the keyboard and its links can be copied.
 */

type Entry = { id: string; label: string };

/** Matches `scroll-mt-24` on the sections, which clears the sticky header. */
const SCROLL_OFFSET = 96;

/** How much of the footer may show before the rail has faded out completely. */
const FADE_DISTANCE = 180;

export function LegalToc() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [open, setOpen] = useState(false);
  // 1 while the rail is over the article, easing to 0 as the footer arrives.
  const [railOpacity, setRailOpacity] = useState(1);
  const railRef = useRef<HTMLElement | null>(null);

  // Read the headings the page actually rendered.
  useEffect(() => {
    const found = [...document.querySelectorAll<HTMLElement>("section[id^='section-']")]
      .map((section) => ({
        id: section.id,
        label: section.querySelector("h2")?.textContent?.trim() ?? "",
      }))
      .filter((entry) => entry.label !== "");

    setEntries(found);
  }, []);

  // Track the last heading scrolled past, and how far through the page we are.
  useEffect(() => {
    if (entries.length === 0) return;

    let frame = 0;

    const measure = () => {
      frame = 0;

      let current = entries[0].id;
      for (const entry of entries) {
        const el = document.getElementById(entry.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= SCROLL_OFFSET + 8) current = entry.id;
      }

      const scrollable = document.documentElement.scrollHeight - window.innerHeight;

      // The last section can be too short to ever reach the offset — the page
      // runs out of scroll with its heading still partway down the screen, and
      // the rail then reports the section above it for the whole tail of the
      // document. Measured on the terms page: at the very bottom, heading 10
      // sits at 191px and the rail said 09. Anyone who has hit the end is in
      // the last section by definition, so say so.
      const atBottom = scrollable > 0 && window.scrollY >= scrollable - 2;
      setActiveId(atBottom ? entries[entries.length - 1].id : current);

      setProgress(scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0);

      // The rail belongs to the article, so it gets out of the way once the
      // footer arrives — otherwise it hangs in the gutter beside a block of
      // links it has nothing to do with, still claiming a section is current
      // when the reader has left the prose entirely.
      //
      // Tied to the footer's own position rather than to a scroll percentage:
      // the two legal pages are different lengths, and the footer is the thing
      // the rail is actually reacting to.
      const footer = document.querySelector("footer");
      if (footer) {
        const overlap = window.innerHeight - footer.getBoundingClientRect().top;
        setRailOpacity(Math.min(1, Math.max(0, 1 - overlap / FADE_DISTANCE)));
      }
    };

    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [entries]);

  const jumpTo = useCallback((event: React.MouseEvent, id: string) => {
    event.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET,
      behavior: reduced ? "auto" : "smooth",
    });

    // Update the hash without a second jump, so the section stays linkable.
    history.replaceState(null, "", `#${id}`);
    setActiveId(id);
  }, []);

  if (entries.length === 0) return null;

  return (
    <>
      {/* ── The rail. ────────────────────────────────────────────────────
          Closed, it is only the ticks and the track — a few dozen pixels that
          sit in the gutter. The labels are `max-w-0 overflow-hidden`, so they
          contribute no width until they open; laying them out and merely
          hiding them made the nav 280px wide at every viewport, which put an
          invisible click target over the right-hand third of the prose on any
          screen narrower than about 1400.

          Open, the labels grow leftward over the text, so the panel takes a
          background. That is the right trade for a transient popover the
          reader summoned by moving onto the rail. */}
      <nav
        ref={railRef}
        aria-label="Sections"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          // Only close once focus has left the rail entirely, or tabbing from
          // one entry to the next would flicker it shut.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
        }}
        style={{
          opacity: open ? 1 : railOpacity,
          // Never a hover target once it is invisible.
          pointerEvents: !open && railOpacity < 0.05 ? "none" : undefined,
        }}
        // Deliberately no `transition-opacity`. The value is already driven
        // frame by frame from scroll position, so a transition would only
        // chase it — each frame restarting a 150ms ease toward a target that
        // has already moved, which shows up as the rail lagging the scroll.
        // It also makes the hover override instant, which is what you want
        // from a control somebody has just reached for.
        className="fixed right-3 top-1/2 z-30 hidden -translate-y-1/2 xl:block 2xl:right-8"
      >
        <div
          className={`flex items-stretch gap-3 rounded-2xl transition-[background-color,box-shadow,padding] duration-200 ease-out motion-reduce:transition-none ${
            open
              ? "border border-stone-200/80 bg-brand-white/95 py-3 pl-4 pr-3 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-sm"
              : "border border-transparent py-3 pl-0 pr-3"
          }`}
        >
          <ul className="flex flex-col justify-center gap-1">
            {entries.map((entry, i) => {
              const isActive = entry.id === activeId;

              return (
                <li key={entry.id} className="flex justify-end">
                  <a
                    href={`#${entry.id}`}
                    onClick={(e) => jumpTo(e, entry.id)}
                    aria-current={isActive ? "true" : undefined}
                    className="group/toc flex min-h-[22px] items-center gap-2.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/60"
                  >
                    <span
                      className={`overflow-hidden whitespace-nowrap text-right font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
                        open ? "max-w-[260px] opacity-100" : "max-w-0 opacity-0"
                      } ${isActive ? "text-brand-teal" : "text-stone-500 group-hover/toc:text-brand-ink"}`}
                    >
                      <span className="mr-1.5 tabular-nums text-stone-400">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {entry.label}
                    </span>

                    {/* The tick. Long and teal for the section you are in,
                        short and grey otherwise, so the rail still reads at a
                        glance with every label closed. */}
                    <span
                      aria-hidden
                      className={`h-px shrink-0 rounded-full transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
                        isActive
                          ? "w-7 bg-brand-teal"
                          : "w-3.5 bg-stone-400 group-hover/toc:w-6 group-hover/toc:bg-brand-teal"
                      }`}
                    />
                  </a>
                </li>
              );
            })}
          </ul>

          {/* The progress track: the "scroll bar" half of the control. It sits
              on the outside so it holds still while the labels open inward. */}
          <div className="relative w-px shrink-0 overflow-hidden rounded-full bg-stone-300/70">
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 rounded-full bg-brand-teal"
              style={{ height: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
      </nav>

      {/* ── Below `xl` there is no room for the rail, so the same list goes inline. ──
          Closed by default: it is a way back to a section, not something to
          read past on the way in, and a closed `<details>` costs one row. */}
      <details className="group/contents mt-10 rounded-3xl border border-stone-200/80 bg-brand-white xl:hidden">
        <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-4 px-6 font-mono text-[11px] font-bold uppercase tracking-[0.24em] text-brand-teal outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/60">
          Contents
          <span
            aria-hidden
            className="text-stone-400 transition-transform duration-200 group-open/contents:rotate-45"
          >
            +
          </span>
        </summary>

        <ul className="flex flex-col gap-1 border-t border-stone-200 px-4 py-4">
          {entries.map((entry, i) => (
            <li key={entry.id}>
              <a
                href={`#${entry.id}`}
                onClick={(e) => jumpTo(e, entry.id)}
                className="flex min-h-[44px] items-center gap-3 rounded-sm px-2 text-[14px] font-medium text-stone-700 transition-colors hover:bg-brand-cream hover:text-brand-teal"
              >
                <span className="font-mono text-[11px] font-bold tabular-nums text-brand-teal">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 break-words">{entry.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
