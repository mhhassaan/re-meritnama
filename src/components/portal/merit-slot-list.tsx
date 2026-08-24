"use client";

import { useRef, useState, useTransition } from "react";
import type { MeritSlot } from "@/lib/portal/merit-list";
import { MeritSlotCard } from "@/components/portal/merit-slot-card";
import { LoadMore } from "@/components/portal/load-more";
import { moreMeritSlots, type MoreSlotsRequest } from "@/lib/portal/merit-list-action";
import { Bezel } from "@/components/app/bezel";
import { ArchiveIcon } from "@/components/icons/koboyo";

/**
 * The seat grid, grown a page at a time.
 *
 * The server renders the first page and this appends the rest in place. It is
 * not a client-side reveal of data already sent: a whole round is 4.19 MB of
 * payload and 23,893 DOM nodes, and hiding cards would leave every byte of that
 * in the response. Each batch is fetched when it is asked for.
 *
 * ## Resetting
 *
 * Filters and round are URL state, so changing one is a same-route navigation —
 * the server re-renders and hands down a new first page, but this component
 * stays mounted and would otherwise keep appending to the previous filter's
 * list. The signature below is compared during render and the accumulated
 * slots are dropped when it changes, which is the supported way to reset state
 * on a prop change: an effect would paint the stale grid first.
 */
export function MeritSlotList({
  initial,
  request,
  pageCount,
  matched,
  total,
}: {
  initial: MeritSlot[];
  /** The filters that produced `initial`, replayed for each further page. */
  request: Omit<MoreSlotsRequest, "page">;
  pageCount: number;
  /** Seats matching the filter, across every page. */
  matched: number;
  /** Seats in the round, before the filter. */
  total: number;
}) {
  const signature = JSON.stringify(request);

  const [slots, setSlots] = useState(initial);
  const [page, setPage] = useState(1);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const seen = useRef(signature);
  if (seen.current !== signature) {
    seen.current = signature;
    setSlots(initial);
    setPage(1);
    setFailed(false);
  }

  function loadMore() {
    const next = page + 1;
    startTransition(async () => {
      const result = await moreMeritSlots({ ...request, page: next });
      if (!result.ok) {
        setFailed(true);
        return;
      }
      // Appended by key rather than concatenated blindly: a round that changed
      // under the reader could otherwise repeat a seat, and two cards for one
      // seat is a bug that looks like data corruption.
      setSlots((prev) => {
        const have = new Set(prev.map(keyOf));
        return [...prev, ...result.slots.filter((slot) => !have.has(keyOf(slot)))];
      });
      setPage(result.page);
    });
  }

  if (matched === 0) {
    return (
      <Bezel className="mt-3" innerClassName="px-8 py-20 text-center">
        <ArchiveIcon className="mx-auto h-8 w-auto text-fg-subtle" />
        <p className="mt-4 font-sans text-base font-bold text-foreground">
          No seats match
        </p>
        <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-fg-muted">
          Try a different filter, or clear the search.
        </p>
      </Bezel>
    );
  }

  return (
    <>
      {/* The match count describes the filter and never the batch on screen.
          Printing only what is loaded would report a filter that found 300
          seats as having found 24. */}
      <p className="mt-6 font-mono text-[11px] text-fg-muted">
        <span className="font-bold text-foreground">
          {matched.toLocaleString("en-GB")}
        </span>{" "}
        of {total.toLocaleString("en-GB")} seats
      </p>

      <div className="mt-3 grid gap-4 2xl:grid-cols-2">
        {slots.map((slot) => (
          <MeritSlotCard key={keyOf(slot)} slot={slot} />
        ))}
      </div>

      {failed ? (
        <p className="mt-6 text-center font-mono text-[11px] text-status-danger">
          Could not load more seats. Reload the page and sign in again.
        </p>
      ) : (
        <LoadMore
          shown={slots.length}
          total={matched}
          loading={pending}
          onClick={loadMore}
        />
      )}

      {/* Guards the case where the server's page count and the accumulated
          list disagree — a filter narrowing between batches, say. */}
      {page >= pageCount && slots.length < matched && (
        <p className="mt-2 text-center font-mono text-[10px] text-fg-subtle">
          The list changed while loading. Reload for the current round.
        </p>
      )}
    </>
  );
}

const keyOf = (slot: MeritSlot) =>
  `${slot.program}|${slot.specialty}|${slot.hospital}|${slot.quota}`;
