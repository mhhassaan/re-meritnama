"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  SHORTLIST_MAX,
  useShortlist,
  type ShortlistItem,
} from "@/lib/shortlist";
import { Bezel } from "@/components/app/bezel";
import { ArchiveIcon } from "@/components/icons/koboyo";

/**
 * The star, and the drawer it fills.
 *
 * The original's shape, kept: a star on the thing itself, a "My Shortlist (N)"
 * opener, a panel listing what you saved with a way back to each one.
 */

/**
 * A save toggle for one item.
 *
 * Rendered inside a card that is itself a link, so it stops the click before it
 * bubbles — without that, starring a hospital navigates to it, which is the
 * single most annoying bug this control can have.
 */
export function ShortlistStar({
  item,
  className = "",
}: {
  item: Omit<ShortlistItem, "addedAt">;
  className?: string;
}) {
  const { items, ready, toggle } = useShortlist();
  const saved = items.some((i) => i.id === item.id);
  const full = !saved && items.length >= SHORTLIST_MAX;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!full) toggle(item);
      }}
      // Before the store has been read, the button is inert rather than
      // showing a confident "not saved" it might be about to contradict.
      disabled={!ready || full}
      aria-pressed={saved}
      title={
        full
          ? `Shortlist is full (${SHORTLIST_MAX})`
          : saved
            ? "Remove from shortlist"
            : "Save to shortlist"
      }
      className={`shrink-0 rounded-sm p-1 text-lg leading-none transition-colors disabled:cursor-not-allowed ${
        saved
          ? "text-status-reach"
          : "text-border-strong hover:text-status-reach"
      } ${className}`}
    >
      <span aria-hidden>{saved ? "★" : "☆"}</span>
      <span className="sr-only">
        {saved ? `Remove ${item.label} from shortlist` : `Save ${item.label}`}
      </span>
    </button>
  );
}

/**
 * The opener and the panel.
 *
 * Through `createPortal` into `document.body`: `<Reveal>` carries a transform,
 * which would make it the containing block for this panel's `position: fixed`
 * — the trap this project has now hit three times.
 */
export function ShortlistDrawer() {
  const { items, ready, remove, clear } = useShortlist();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[40px] items-center gap-2 rounded-sm border border-border-strong px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-fg-muted transition-colors hover:border-accent hover:text-foreground"
      >
        <span aria-hidden className="text-status-reach">
          ★
        </span>
        My shortlist
        {/* Rendered only once the store has been read, so the count never
            flashes 0 for somebody who has saved things. */}
        {ready && items.length > 0 && (
          <span className="tabular-nums text-accent">{items.length}</span>
        )}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            role="presentation"
          >
            <aside
              role="dialog"
              aria-modal="true"
              aria-label="My shortlist"
              onClick={(e) => e.stopPropagation()}
              className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border-strong bg-surface p-6 shadow-ambient"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-sans text-base font-bold text-foreground">
                    My shortlist
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
                    {items.length} of {SHORTLIST_MAX} saved
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="shrink-0 rounded-sm border border-border-strong px-2.5 py-1 font-mono text-xs text-fg-muted transition-colors hover:border-accent hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              {items.length === 0 ? (
                <Bezel className="mt-6" innerClassName="px-6 py-12 text-center">
                  <ArchiveIcon className="mx-auto h-7 w-auto text-fg-subtle" />
                  <p className="mt-3 font-sans text-sm font-bold text-foreground">
                    Nothing saved yet
                  </p>
                  <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-fg-muted">
                    Tap the star on a hospital to keep it here while you decide.
                  </p>
                </Bezel>
              ) : (
                <>
                  <ul className="mt-6 flex flex-col gap-2">
                    {items.map((item) => (
                      <li key={item.id}>
                        <Bezel innerClassName="flex items-center gap-3 p-3">
                          <div className="min-w-0 flex-1">
                            <Link
                              href={item.href}
                              onClick={() => setOpen(false)}
                              className="block truncate font-sans text-sm font-bold text-accent transition-colors hover:underline"
                            >
                              {item.label}
                            </Link>
                            {item.meta && (
                              <p className="mt-0.5 truncate font-mono text-[10px] text-fg-subtle">
                                {item.meta}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => remove(item.id)}
                            aria-label={`Remove ${item.label}`}
                            className="shrink-0 rounded-sm px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-fg-subtle transition-colors hover:text-status-danger"
                          >
                            Remove
                          </button>
                        </Bezel>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={clear}
                    className="mt-4 self-start font-mono text-[10px] uppercase tracking-wider text-fg-subtle transition-colors hover:text-status-danger"
                  >
                    Clear all
                  </button>
                </>
              )}

              <p className="mt-auto pt-8 text-xs leading-relaxed text-fg-subtle">
                Saved in this browser only. Nothing is sent to the server, so
                nobody can see what you are considering — and it will not follow
                you to another device.
              </p>
            </aside>
          </div>,
          document.body
        )}
    </>
  );
}
