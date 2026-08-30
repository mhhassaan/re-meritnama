import { Bezel } from "@/components/app/bezel";

/**
 * Loading placeholders.
 *
 * ## Where a skeleton belongs, and where it does not
 *
 * A skeleton is right when there is **nothing on screen yet** — a fresh
 * navigation to a page that has to read the database before it can say
 * anything. It is wrong when a result is already showing and is about to be
 * replaced by a different one: the old result is still the true answer for the
 * filter that produced it, and swapping it for grey boxes throws away
 * information *and* makes a filter change read as a page load. That case dims
 * instead — `FilterPending`.
 *
 * So these appear in `loading.tsx`, and nowhere else.
 *
 * ## Shape, not spinner
 *
 * The point of a placeholder is to promise a layout, so nothing moves when the
 * content lands. These mirror the house page template — eyebrow, display
 * heading, standfirst, a stats bar, then content — because nearly every page in
 * this app is built from it.
 *
 * The sweep runs left to right, the way the text it stands in for is read, and
 * is a composited `translateX` rather than an animated `background-position`.
 * It stops entirely under `prefers-reduced-motion`; see `globals.css`.
 *
 * ## Announcing it
 *
 * One `role="status"` with a screen-reader label on the outermost skeleton per
 * page. Marking every bar would make a screen reader read "loading" thirty
 * times, which is worse than silence.
 */

export function SkeletonBar({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton rounded-sm ${className}`} />;
}

/** A line of body text. Widths vary so it reads as prose, not as a table. */
export function SkeletonLines({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  // A last line shorter than the rest is what makes a block of bars look like a
  // paragraph rather than a barcode.
  const widths = ["w-full", "w-[92%]", "w-[97%]", "w-[85%]", "w-[60%]"];

  return (
    <div aria-hidden className={`flex flex-col gap-2.5 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonBar
          key={i}
          className={`h-3.5 ${i === lines - 1 ? "w-[60%]" : widths[i % 4]}`}
        />
      ))}
    </div>
  );
}

/** The four-cell figure strip most pages open with. */
export function SkeletonStats({ cells = 4 }: { cells?: number }) {
  return (
    <Bezel
      className="mt-12"
      innerClassName="grid grid-cols-2 gap-px bg-border sm:grid-cols-4"
    >
      {Array.from({ length: cells }, (_, i) => (
        <div key={i} className="bg-surface p-3">
          <SkeletonBar className="h-2.5 w-20" />
          <SkeletonBar className="mt-2.5 h-5 w-16" />
        </div>
      ))}
    </Bezel>
  );
}

/** A card in a list or grid. */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <Bezel innerClassName="p-5">
      <div className="flex flex-wrap gap-2">
        <SkeletonBar className="h-4 w-20" />
        <SkeletonBar className="h-4 w-24" />
      </div>
      <SkeletonBar className="mt-3.5 h-4 w-[70%]" />
      <SkeletonLines lines={lines} className="mt-3" />
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <SkeletonBar className="h-3 w-32" />
        <SkeletonBar className="h-3 w-16" />
      </div>
    </Bezel>
  );
}

/** A table, for the pages whose content is rows rather than cards. */
export function SkeletonTable({ rows = 8 }: { rows?: number }) {
  return (
    <Bezel className="mt-3" innerClassName="p-0">
      <div className="border-b border-border p-4">
        <SkeletonBar className="h-3 w-40" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
        >
          <SkeletonBar className="h-3.5 flex-1" />
          <SkeletonBar className="hidden h-3.5 w-24 sm:block" />
          <SkeletonBar className="hidden h-3.5 w-20 md:block" />
          <SkeletonBar className="h-3.5 w-12" />
        </div>
      ))}
    </Bezel>
  );
}

/**
 * The whole page, in the house shape.
 *
 * `label` names what is loading so the announcement is useful — "Loading the
 * merit table" rather than "Loading".
 */
export function SkeletonPage({
  label = "the page",
  stats = true,
  variant = "cards",
  width = "max-w-[1200px]",
}: {
  label?: string;
  stats?: boolean;
  variant?: "cards" | "table" | "prose";
  width?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`mx-auto ${width} px-4 py-14 motion-safe:animate-[skeletonIn_120ms_ease-out] sm:px-6 md:py-20 lg:px-8`}
    >
      <span className="sr-only">Loading {label}…</span>

      {/* Eyebrow, display heading, standfirst — the opening every page shares,
          so the real content lands where the placeholder was. */}
      <SkeletonBar className="h-6 w-32 rounded-full" />
      <SkeletonBar className="mt-6 h-11 w-[min(28rem,80%)]" />
      <SkeletonBar className="mt-3 h-11 w-[min(20rem,60%)]" />
      <SkeletonLines lines={2} className="mt-7 max-w-2xl" />

      {stats && <SkeletonStats />}

      {variant === "table" ? (
        <SkeletonTable />
      ) : variant === "prose" ? (
        <div className="mt-10 flex flex-col gap-6">
          <SkeletonLines lines={4} />
          <SkeletonLines lines={5} />
          <SkeletonLines lines={3} />
        </div>
      ) : (
        <div className="mt-10 flex flex-col gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard lines={1} />
        </div>
      )}
    </div>
  );
}
