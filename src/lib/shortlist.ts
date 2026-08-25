"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Saved shortlist — "keep this to look at later", across pages.
 *
 * The original's `js/shortlist.js`: a star on anything, a drawer listing what
 * you saved, `localStorage` under `mn_shortlist`. Kept in the browser here too,
 * and that is the right place rather than a concession.
 *
 * A shortlist is a **viewing preference, not evidence**. Nothing decides
 * anything from it, nobody else reads it, and it says something about a
 * person's intentions during a live cycle — which hospitals a named candidate
 * is circling is exactly the kind of thing this product should not be holding
 * on a server it does not need to. The same reasoning as `find-me` and the
 * manual candidate.
 *
 * ## Generic on purpose
 *
 * `type` is free text and an item carries its own `href` and `meta`, so a page
 * opts in by rendering a star rather than by this module knowing about it. The
 * original is built the same way, and only its hospital pages use it — ours
 * match that rather than inventing new places to save from.
 */

const STORAGE_KEY = "mn_shortlist";
const CHANGED_EVENT = "mn-shortlist-changed";

/** How many can be saved. */
export const SHORTLIST_MAX = 40;

export type ShortlistItem = {
  /** Unique across types — prefix it, e.g. `hospital:mayo-hospital-lahore`. */
  id: string;
  type: string;
  label: string;
  /** Where the star was, so the drawer can go back to it. */
  href: string;
  /** One line of context under the label. */
  meta?: string;
  addedAt: number;
};

function read(): ShortlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as ShortlistItem[]) : [];
  } catch {
    // A corrupted value is not worth a crash on a page whose real content is
    // the seat matrix. An unreadable shortlist is an empty one.
    return [];
  }
}

function write(items: ShortlistItem[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  // `storage` fires for other tabs but never for the one that wrote, so the
  // custom event is what keeps the stars on this page in step with the drawer.
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

/**
 * The saved list, kept in step across every star and the drawer.
 *
 * Read after mount rather than during render: `localStorage` does not exist on
 * the server, so seeding state from it directly makes the first client render
 * disagree with the HTML and fails hydration — the trap the avatar work already
 * met. The cost is one frame showing an unsaved star to somebody who saved it.
 */
export function useShortlist() {
  const [items, setItems] = useState<ShortlistItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setItems(read());
    sync();
    setReady(true);

    window.addEventListener("storage", sync);
    window.addEventListener(CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CHANGED_EVENT, sync);
    };
  }, []);

  const toggle = useCallback((item: Omit<ShortlistItem, "addedAt">) => {
    const current = read();
    const existing = current.some((i) => i.id === item.id);

    if (existing) {
      write(current.filter((i) => i.id !== item.id));
      return false;
    }

    // Newest first, and capped. Without a cap this grows until the browser
    // refuses the write, which surfaces as a star that silently stops working.
    write([{ ...item, addedAt: Date.now() }, ...current].slice(0, SHORTLIST_MAX));
    return true;
  }, []);

  const remove = useCallback((id: string) => {
    write(read().filter((i) => i.id !== id));
  }, []);

  const clear = useCallback(() => write([]), []);

  return { items, ready, toggle, remove, clear };
}
