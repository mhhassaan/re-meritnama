"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

/**
 * Navigating for a filter change, without it reading as a page load.
 *
 * Every filtered surface here keeps its state in the URL, so applying a filter
 * is a same-route navigation. That was already a *client* transition — measured,
 * the document survives and React reconciles rather than rebuilding, keeping the
 * same DOM nodes — but it still felt like a reload for two reasons, and this
 * fixes both.
 *
 * **The scroll jumped to the top.** Next.js scrolls to the top of the document
 * on navigation by default, which is right when the destination is a different
 * page and wrong when the reader has scrolled to a row and changed a dropdown
 * beside it. `scroll: false` keeps them where they were. Pagination is the
 * exception and deliberately does not use this — going from page 1 to page 2
 * while parked at the bottom of the old page is worse than being taken to the
 * top of the new one.
 *
 * **The UI froze for the length of the server render.** Without a transition,
 * React blocks the commit until the server component resolves, so on these
 * pages — 1.5 s for a filtered read of the accreditation register — the page
 * sits unresponsive with no sign that anything is happening. Inside
 * `startTransition` the previous result stays painted and interactive, and
 * `pending` gives the caller something honest to show meanwhile.
 */
export function useFilterNav() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const go = useCallback(
    (href: string, options?: { scroll?: boolean }) => {
      startTransition(() =>
        router.push(href, { scroll: options?.scroll ?? false })
      );
    },
    [router]
  );

  return { go, pending };
}
