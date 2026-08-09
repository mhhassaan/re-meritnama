import { verseOfTheDay } from "@/lib/verses";

/**
 * The daily verse, shown at the top of the candidate app.
 *
 * A Server Component on purpose: the verse is chosen from the date, so
 * rendering it on the server means one HTML payload with no client JavaScript
 * and no hydration risk.
 *
 * The warm accent (`--hope`) is reserved for exactly this kind of moment —
 * encouragement, celebration, softening a discouraging result. Using it here is
 * what makes it mean something elsewhere.
 */
export function VerseStrip({ className = "" }: { className?: string }) {
  const verse = verseOfTheDay();

  return (
    <aside
      // Not `role="note"`: this is supplementary content a screen reader user
      // can skip, and labelling it lets them do that deliberately.
      aria-label="Daily verse"
      // Tighter on mobile: at full size it consumed most of the first screen and
      // pushed the actual content below the fold.
      className={`border-b border-border bg-surface-sunken px-4 py-3.5 text-center sm:py-6 ${className}`}
    >
      {/* lang + dir so screen readers switch voice and the text shapes
          correctly regardless of the surrounding page direction. */}
      <p
        lang="ar"
        dir="rtl"
        className="mx-auto max-w-3xl text-base leading-[1.9] text-hope sm:text-2xl sm:leading-[2]"
      >
        {verse.arabic}
      </p>

      <p className="mx-auto mt-1.5 max-w-2xl font-serif text-xs italic leading-snug text-fg-muted sm:mt-3 sm:text-base sm:leading-relaxed">
        {verse.translation}
      </p>

      <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-fg-subtle sm:mt-2 sm:text-[11px]">
        {verse.reference}
      </p>
    </aside>
  );
}
