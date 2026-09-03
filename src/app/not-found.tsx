import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Not found | MeritNama",
};

/**
 * The 404 for addresses outside the signed-in app — a mistyped marketing URL,
 * a stale external link, a route that never existed.
 *
 * Standalone rather than inside the app shell, because the reader may not be
 * signed in and rendering a navigation rail full of destinations that would all
 * bounce them to `/auth` is worse than offering the two doors that work.
 *
 * Styled from the semantic tokens like everything else, so it follows the
 * theme rather than being a bare browser page.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-20 text-center text-foreground">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-accent">
        404
      </p>

      <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl text-balance">
        This page does{" "}
        <span className="text-accent">not exist</span>
      </h1>

      <p className="mt-7 max-w-md text-[15px] leading-relaxed text-fg-muted">
        The address is wrong, or the page has moved. Nothing is broken, and
        nothing you were looking at has been lost.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/app"
          className="min-h-[46px] rounded-sm bg-accent-strong px-6 py-3 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98]"
        >
          Go to the app
        </Link>
        <Link
          href="/"
          className="min-h-[46px] rounded-sm border border-border-strong px-6 py-3 font-mono text-[11px] font-bold uppercase tracking-wider text-fg-muted transition-colors hover:border-accent hover:text-foreground"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
