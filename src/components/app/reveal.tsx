"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Fades and lifts its children into place as they enter the viewport.
 *
 * `IntersectionObserver`, not a scroll listener: a scroll handler fires on
 * every frame of every scroll and forces layout each time, which on the
 * mid-range Android phones this product is actually used on costs more than the
 * animation is worth.
 *
 * Only `transform` and `opacity` animate — both composited, neither triggering
 * layout. Nothing here animates `height`, `top` or `filter`.
 *
 * Reveals once and then disconnects. Re-animating on every scroll past turns a
 * long results page into a slot machine.
 *
 * **Never wrap a subtree containing a `position: fixed` overlay.** This element
 * carries a `transform`, and a transformed ancestor becomes the containing
 * block for fixed descendants — a modal or bottom sheet inside will anchor to
 * this box instead of the viewport.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  /** Stagger, in ms. Keep the ladder short — 3 or 4 steps, then stop. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Someone who has asked the system for less motion gets the end state
    // immediately. This is not decoration they opted into.
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reducedMotion) {
      setShown(true);
      return;
    }

    // Anything already on screen — or scrolled past, which happens when the
    // browser restores a scroll position on reload or the page is opened at an
    // anchor — is shown at once. An IntersectionObserver never fires for an
    // element sitting above the viewport, so without this the content stays at
    // opacity 0 permanently. Entry animation is a nicety; the content is not.
    if (node.getBoundingClientRect().top < window.innerHeight) {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        observer.disconnect();
      },
      // Fires slightly before the element is fully on screen, so the motion is
      // finishing as the reader arrives rather than starting.
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}
      className={`transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${
        shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}
