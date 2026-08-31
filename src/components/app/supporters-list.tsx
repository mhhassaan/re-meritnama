"use client";

import { useState } from "react";
import type { Supporter } from "@/lib/support/supporters";

const BATCH = 30;

/**
 * The supporters list.
 *
 * Shown in batches rather than all 185 at once — the original renders the lot,
 * which is 185 cards nobody scrolls to the end of, and the tail is the oldest
 * contributions rather than anything a reader is looking for.
 *
 * A withheld name renders as "Anonymous supporter" with the amount and date
 * intact, so the row still counts toward what a reader sees rather than
 * vanishing. One entry is in that state: somebody typed an email address into
 * the name box on the original, and it publishes it.
 */
export function SupportersList({ supporters }: { supporters: Supporter[] }) {
  const [shown, setShown] = useState(BATCH);
  const visible = supporters.slice(0, shown);
  const remaining = supporters.length - visible.length;

  return (
    <>
      {/* 185 supporters was 185 boxes. The hairline grid's construction,
          written out here because a list wants a real `<ul>`: the container
          paints the border colour and shows through only the 1px gaps between
          opaque cells. */}
      <ul className="mt-4 grid gap-px bg-border sm:grid-cols-2">
        {visible.map((s, i) => (
          <li key={`${s.name ?? "anon"}-${s.date}-${i}`} className="bg-background">
            <div className="flex items-center gap-3 p-3">
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-quiet font-sans text-[11px] font-black uppercase text-accent"
              >
                {s.name ? initials(s.name) : "—"}
              </span>

              <div className="min-w-0 flex-1">
                <p
                  className={`truncate font-sans text-[13px] font-bold ${
                    s.name ? "text-foreground" : "italic text-fg-subtle"
                  }`}
                >
                  {s.name ?? "Anonymous supporter"}
                </p>
                <p className="font-mono text-[10px] text-fg-subtle">{s.date}</p>
              </div>

              <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-accent">
                {s.usd == null ? "—" : `$${s.usd.toFixed(2)}`}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {remaining > 0 && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setShown((n) => n + BATCH)}
            className="rounded-sm border border-border-strong px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-fg-muted transition-colors hover:border-accent hover:text-foreground"
          >
            Show more
          </button>
          <p className="font-mono text-[10px] text-fg-subtle">
            {visible.length} of {supporters.length} shown · {remaining} more
          </p>
        </div>
      )}
    </>
  );
}

/** Two letters, matching the original's avatar chips. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}
