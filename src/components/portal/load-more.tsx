"use client";

import { ArrowDown02Icon } from "@/components/ui/arrow-down-02";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";

/**
 * The "Load more" control.
 *
 * Shared by the Merit List and Seat Allocation so the two long card grids
 * behave the same way. It states how many are left rather than saying only
 * "Load more": on a list of several hundred seats, "24 of 742 shown" is the
 * thing the reader needs in order to decide whether to keep clicking or to
 * filter instead.
 *
 * Deliberately a button and not a scroll sentinel. Automatic infinite scroll on
 * a page with a footer note about confirming against the official gazette means
 * the note keeps running away from the reader, and it takes the choice of how
 * much to load away from someone on a metered connection.
 */
export function LoadMore({
  shown,
  total,
  loading,
  onClick,
  noun = "seats",
}: {
  shown: number;
  total: number;
  loading?: boolean;
  onClick: () => void;
  noun?: string;
}) {
  // Before the early return: a hook cannot be called conditionally.
  const { ref: icon, handlers } = useActionIcon();

  if (shown >= total) {
    // Saying so ends the list honestly. Without it, a grid that simply stops
    // reads as more content failing to load.
    return (
      <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-fg-subtle">
        All {total.toLocaleString("en-GB")} {noun} shown
      </p>
    );
  }

  const remaining = total - shown;

  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        {...handlers}
        className="group flex min-h-[46px] items-center gap-3 rounded-sm bg-accent-strong py-2 pl-5 pr-2 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98] disabled:cursor-progress disabled:opacity-60"
      >
        {loading ? "Loading…" : "Load more"}
        {/* A div inside the button, not inside a span — these icons render a
            div, and a div in a span is invalid HTML that fails hydration. */}
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-[250ms] group-hover:translate-y-0.5">
          <ArrowDown02Icon ref={icon} size={ICON_SIZE_SM} aria-hidden />
        </span>
      </button>

      <p aria-live="polite" className="font-mono text-[10px] text-fg-subtle">
        {shown.toLocaleString("en-GB")} of {total.toLocaleString("en-GB")} {noun}{" "}
        shown · {remaining.toLocaleString("en-GB")} more
      </p>
    </div>
  );
}
