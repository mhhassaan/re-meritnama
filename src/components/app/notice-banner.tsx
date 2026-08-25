"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Notice } from "@/lib/announce/data";

/**
 * Staff announcements, above every page in the app shell.
 *
 * ## Dismissal is local, and per notice
 *
 * Which banners a person has already read is a viewing preference, not
 * something the product needs to hold: a row per user per notice would be a new
 * table, a new policy and a write on page load, to remember that somebody
 * clicked ✕. `localStorage`, keyed by notice id, and a new announcement appears
 * for everybody because its id has never been dismissed.
 *
 * Read after mount rather than during render — `localStorage` does not exist on
 * the server, and seeding state from it fails hydration. The cost is one frame
 * showing a banner somebody has dismissed, which is why the container reserves
 * no height: it is `null` until the store has been read, so nothing below it
 * moves when the banner turns out to be dismissed.
 */

const STORAGE_KEY = "mn_dismissed_notices";

const TONE: Record<Notice["kind"], string> = {
  info: "border-accent/40 bg-accent-quiet",
  success: "border-status-safe/40 bg-status-safe/10",
  warning: "border-status-reach/40 bg-status-reach/10",
  danger: "border-status-danger/40 bg-status-danger/10",
};

const ACCENT: Record<Notice["kind"], string> = {
  info: "text-accent",
  success: "text-status-safe",
  warning: "text-status-reach",
  danger: "text-status-danger",
};

function readDismissed(): number[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}

export function NoticeBanner({ notices }: { notices: Notice[] }) {
  const [dismissed, setDismissed] = useState<number[] | null>(null);

  useEffect(() => setDismissed(readDismissed()), []);

  if (dismissed === null) return null;

  const visible = notices.filter((n) => !n.dismissable || !dismissed.includes(n.id));
  if (visible.length === 0) return null;

  function dismiss(id: number) {
    const next = [...readDismissed(), id];
    // Capped: without it this grows for the life of the browser profile, and
    // the list is only ever read to answer "has this one been seen".
    const capped = next.slice(-200);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
    setDismissed(capped);
  }

  return (
    <div className="flex flex-col gap-px">
      {visible.map((notice) => (
        <div
          key={notice.id}
          role="status"
          className={`flex items-start gap-3 border-b px-4 py-3 sm:px-6 ${TONE[notice.kind]}`}
        >
          {notice.icon && (
            <span aria-hidden className="mt-px shrink-0 text-base leading-none">
              {notice.icon}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p
              className={`break-words font-sans text-sm font-bold leading-snug ${ACCENT[notice.kind]}`}
            >
              {notice.title}
            </p>
            <p className="mt-1 break-words text-xs leading-relaxed text-fg-muted">
              {notice.body}
            </p>

            {notice.link && (
              <Link
                href={notice.link}
                className="mt-1.5 inline-block font-mono text-[11px] font-bold uppercase tracking-wider text-accent underline"
              >
                {notice.linkText || "Open"}
              </Link>
            )}
          </div>

          {notice.dismissable && (
            <button
              type="button"
              onClick={() => dismiss(notice.id)}
              aria-label={`Dismiss: ${notice.title}`}
              className="shrink-0 rounded-sm px-2 py-0.5 font-mono text-xs text-fg-subtle transition-colors hover:text-foreground"
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
