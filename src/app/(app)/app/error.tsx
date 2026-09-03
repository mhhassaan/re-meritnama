"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { AlertIcon, RefreshIcon } from "@/components/icons/koboyo";

/**
 * The error boundary for every page under `/app`.
 *
 * ## What it deliberately does not show
 *
 * Not `error.message`. A thrown Postgres error names tables, columns and
 * policies — "new row violates row-level security policy for table
 * candidates" — which tells a reader nothing they can act on and tells anybody
 * probing the app the shape of the schema. Next.js already redacts these in
 * production; this page does not undo that by printing whatever survives.
 *
 * What is shown is the **digest**, which is the id that ties this failure to a
 * server log line. A person reporting a problem with that string is far easier
 * to help than one reporting "it broke".
 *
 * ## Retry first, navigate second
 *
 * `reset()` re-renders the segment without a full page load, and most failures
 * here are a timed-out read of a large table rather than anything permanent, so
 * trying again genuinely tends to work. The links below it are for when it does
 * not.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Left in on purpose. Without it the digest on screen is the only trace,
    // and a developer with the browser open should not have to ask the user to
    // read it out.
    console.error("App route error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-[760px] px-4 py-20 sm:px-6 md:py-28 lg:px-8">
      <Eyebrow>Something went wrong</Eyebrow>

      <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-5xl text-balance">
        That did not{" "}
        <span className="text-accent">load</span>
      </h1>

      <p className="mt-7 max-w-xl text-[15px] leading-relaxed text-fg-muted">
        Something failed while building this page. Your account, your record and
        anything you had saved are untouched — nothing here writes on a page
        load.
      </p>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="group flex min-h-[46px] items-center gap-3 rounded-sm bg-accent-strong py-2 pl-5 pr-2 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98]"
        >
          Try again
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
            <RefreshIcon className="h-4 w-auto" />
          </span>
        </button>

        <Link
          href="/app"
          className="min-h-[46px] rounded-sm border border-border-strong px-5 py-3 font-mono text-[11px] font-bold uppercase tracking-wider text-fg-muted transition-colors hover:border-accent hover:text-foreground"
        >
          Back to the portal
        </Link>
      </div>

      <Bezel className="mt-10" innerClassName="flex items-start gap-3 p-5">
        <AlertIcon className="mt-0.5 h-4 w-auto shrink-0 text-status-reach" />
        <div className="min-w-0 text-sm leading-relaxed text-fg-muted">
          <p>
            Most failures here are a slow read of a large table timing out, so
            trying again usually works. If it keeps happening, the reference
            below identifies this exact failure in the server log.
          </p>
          {error.digest && (
            <p className="mt-3 font-mono text-[11px] text-fg-subtle">
              Reference:{" "}
              <span className="select-all font-bold text-foreground">
                {error.digest}
              </span>
            </p>
          )}
        </div>
      </Bezel>
    </div>
  );
}
