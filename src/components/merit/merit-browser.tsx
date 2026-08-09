"use client";

import { useMemo, useState } from "react";
import type { MeritRow } from "@/lib/merit/types";
import type { MeritQuery, SortKey } from "@/lib/merit/query";
import { applyQuery } from "@/lib/merit/query";
import { MeritFilters, type Facets } from "./merit-filters";
import { MeritTable } from "./merit-table";
import { MeritCard } from "./merit-card";

/**
 * Merit browser: filters plus whichever presentation suits the viewport.
 *
 * Filtering runs client-side over the full 1,470 rows. That is a deliberate
 * trade: the dataset is small enough to hold in memory, and doing it locally
 * makes typing in the search box instant rather than a round trip per
 * keystroke — which matters most on the slow mobile connections this is used
 * over during a live round.
 */

const PAGE_SIZE = 60;

export function MeritBrowser({
  rows,
  inductions,
  facets,
}: {
  rows: MeritRow[];
  inductions: number[];
  facets: Facets;
}) {
  const [query, setQuery] = useState<MeritQuery>({
    scale: "normalised",
    sort: "specialty",
    direction: "asc",
  });
  const [visible, setVisible] = useState(PAGE_SIZE);

  const results = useMemo(() => applyQuery(rows, query), [rows, query]);

  const update = (next: Partial<MeritQuery>) => {
    setQuery((current) => ({ ...current, ...next }));
    // Any change to the query means the previous scroll position is meaningless.
    setVisible(PAGE_SIZE);
  };

  const toggleSort = (key: SortKey) => {
    setQuery((current) => ({
      ...current,
      sort: key,
      // Re-clicking the active column flips direction; a new column starts
      // ascending, which is the conventional expectation.
      direction:
        current.sort === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const shown = results.slice(0, visible);
  const scale = query.scale ?? "normalised";

  return (
    <div className="flex flex-col gap-5">
      <MeritFilters
        facets={facets}
        query={query}
        resultCount={results.length}
        totalCount={rows.length}
        onChange={update}
      />

      {results.length === 0 ? (
        <div className="rounded-md border border-border bg-surface p-8 text-center">
          <p className="font-sans text-sm font-bold text-foreground">
            No seat combinations match those filters
          </p>
          <p className="mt-2 text-xs leading-relaxed text-fg-muted">
            Not every specialty runs at every hospital, and not every hospital
            offers every quota. Try clearing one filter.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile */}
          <ul className="flex flex-col gap-3 md:hidden">
            {shown.map((row) => (
              <MeritCard
                key={`${row.program}|${row.quota}|${row.specialty}|${row.hospital}`}
                row={row}
                inductions={inductions}
                scale={scale}
              />
            ))}
          </ul>

          {/* Desktop */}
          <div className="hidden md:block">
            <MeritTable
              rows={shown}
              inductions={inductions}
              scale={scale}
              sort={query.sort ?? "specialty"}
              direction={query.direction ?? "asc"}
              onSort={toggleSort}
            />
          </div>

          {visible < results.length && (
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="mx-auto flex min-h-[48px] items-center justify-center rounded-sm border border-border-strong px-6 text-sm font-bold text-fg-muted transition-colors hover:text-foreground"
            >
              Show more ({(results.length - visible).toLocaleString("en-GB")} remaining)
            </button>
          )}
        </>
      )}

      {/* Stated wherever raw numbers can appear, because a raw merit from one
          cycle genuinely is not comparable to another's. */}
      <p className="text-xs leading-relaxed text-fg-subtle">
        {scale === "raw" ? (
          <>
            <span className="font-bold text-status-reach">Raw marks.</span> Each
            cycle had a different total — 95 marks up to Induction 16, then 60,
            35 and 30. Numbers from different cycles are <em>not</em> comparable.
            Switch to % of max to compare across years.
          </>
        ) : (
          <>Each closing merit shown as a percentage of that cycle&apos;s total marks, so cycles are comparable despite the scoring policy changing.</>
        )}
      </p>
    </div>
  );
}
