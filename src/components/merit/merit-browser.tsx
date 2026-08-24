"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Bezel } from "@/components/app/bezel";

import type { MeritRow } from "@/lib/merit/types";
import type { Cycle } from "@/lib/merit/data";
import type { MeritQuery, SortKey } from "@/lib/merit/query";
import { applyQuery, visibleCycleCount } from "@/lib/merit/query";
import { MeritFilters, type Facets } from "./merit-filters";
import { MeritTable } from "./merit-table";
import { MeritCard } from "./merit-card";
import { MeritDetail } from "./merit-detail";

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
  cycles,
  facets,
}: {
  rows: MeritRow[];
  cycles: Cycle[];
  facets: Facets;
}) {
  // The chart and sparkline modules work in induction numbers, because that is
  // the key into the data. Nothing user-facing prints one.
  const inductions = useMemo(() => cycles.map((c) => c.induction), [cycles]);

  const [selected, setSelected] = useState<MeritRow | null>(null);
  const [query, setQuery] = useState<MeritQuery>({
    scale: "normalised",
    sort: "specialty",
    direction: "asc",
    // Last five cycles by default, as the live site does. The older cycles ran
    // under scoring policies two or three revisions out of date.
    cycleRange: 5,
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

  // Columns are trimmed from the front: the most recent cycles are the ones
  // that inform a decision about the next one.
  const columnCycles = useMemo(
    () =>
      cycles.slice(
        -visibleCycleCount(query.cycleRange ?? 5, cycles.length)
      ),
    [cycles, query.cycleRange]
  );

  return (
    <div className="flex flex-col gap-6">
      {/* The controls sit in their own enclosure so the table below reads as a
          separate plane rather than one continuous wall of chrome. */}
      <Bezel innerClassName="p-3 sm:p-4">
        <MeritFilters
          facets={facets}
          cycles={cycles}
          query={query}
          resultCount={results.length}
          totalCount={rows.length}
          onChange={update}
        />
      </Bezel>

      {results.length === 0 ? (
        <Bezel innerClassName="px-8 py-16 text-center">
          <p className="font-sans text-base font-bold text-foreground">
            No records match those filters
          </p>
          <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed text-fg-muted">
            Not every specialty runs at every hospital, and not every hospital
            offers every quota. Try clearing one filter.
          </p>
        </Bezel>
      ) : (
        <>
          {/* Mobile */}
          <ul className="flex flex-col gap-3 md:hidden">
            {shown.map((row) => (
              <MeritCard
                key={`${row.program}|${row.quota}|${row.specialty}|${row.hospital}`}
                row={row}
                cycles={cycles}
                scale={scale}
              />
            ))}
          </ul>

          {/* Desktop: table on the left, detail beside it, as the original
              does. This only works because the cycle-range selector keeps the
              table narrow — with all thirteen columns showing, a side panel
              would take width the table needs. */}
          <div className="hidden md:grid md:items-start md:gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <MeritTable
              rows={shown}
              cycles={columnCycles}
              scale={scale}
              sort={query.sort ?? "specialty"}
              direction={query.direction ?? "asc"}
              onSort={toggleSort}
              selected={selected}
              onSelect={setSelected}
            />

            {selected && (
              // Sticky so it stays with the reader as they scan down the rows
              // it describes, which is the whole point of a side panel.
              <MeritDetail
                row={selected}
                cycles={cycles}
                onClose={() => setSelected(null)}
                className="lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:w-[26rem] lg:overflow-y-auto"
              />
            )}
          </div>

          {visible < results.length && (
            // Squared corners, per the guidelines' rule on action buttons — the
            // pill geometry lives only in the nested icon.
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="group mx-auto flex min-h-[52px] items-center gap-3 rounded-sm border border-border-strong bg-surface py-2 pl-6 pr-2 text-sm font-bold text-fg-muted shadow-ambient transition-all duration-[350ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-accent hover:text-foreground active:scale-[0.98]"
            >
              <span>
                Show {Math.min(PAGE_SIZE, results.length - visible)} more
                <span className="ml-2 font-mono text-[11px] font-normal text-fg-subtle">
                  {(results.length - visible).toLocaleString("en-GB")} left
                </span>
              </span>

              {/* The chevron never sits naked beside the label; it gets its own
                  well, which is what carries the kinetic tension on hover. */}
              <span
                aria-hidden
                className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-quiet text-accent transition-transform duration-[350ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-y-0.5 group-hover:scale-105"
              >
                <ChevronDown className="h-4 w-4" />
              </span>
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
            year had a different total — 95 marks through 2024, then 60, 35 and
            30. Numbers from different years are <em>not</em> comparable. Switch
            to % of max to compare across years.
          </>
        ) : (
          <>Each closing merit shown as a percentage of that year&apos;s total marks, so years are comparable despite the scoring policy changing.</>
        )}
      </p>
    </div>
  );
}
