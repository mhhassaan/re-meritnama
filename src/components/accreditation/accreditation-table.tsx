"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { AccreditationRow } from "@/lib/accreditation/data";
import {
  moreAccreditedPrograms,
  type MoreProgramsRequest,
} from "@/lib/accreditation/action";
import { LoadMore } from "@/components/portal/load-more";
import { Bezel } from "@/components/app/bezel";
import { formatDate } from "@/lib/format/date";
import { ArchiveIcon } from "@/components/icons/koboyo";
import { Calendar03Icon } from "@/components/ui/calendar-03";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";

/**
 * How the Since column is written.
 *
 * `readable` is this site's house format, unambiguous by construction —
 * "22 May 2017" cannot be misread the way a numeric date can, which matters
 * here because the source is `DD-MM-YYYY` and half the world reads that
 * month-first. `register` is the string CPSP published, for anyone checking a
 * row against the official page line by line.
 */
type DateStyle = "readable" | "register";

const DATE_STYLE_KEY = "mn_accreditation_date_style";

/**
 * The accreditation code, drawn as the badge the official register draws.
 *
 * The colours are the original's and they carry meaning: F.A. green, P.A.
 * amber. It has no rule for T.A. or for the one written-out phrase, so those
 * stay uncoloured here too — assigning a severity CPSP has not published would
 * be inventing a claim, and this table already declines to expand the codes
 * into words for the same reason.
 */
function TypeBadge({ type }: { type: string }) {
  const tone =
    type === "F.A."
      ? "border-status-safe/40 bg-status-safe/10 text-status-safe"
      : type === "P.A."
        ? "border-status-reach/40 bg-status-reach/10 text-status-reach"
        : "border-border-strong bg-surface-sunken text-fg-muted";

  const dot =
    type === "F.A."
      ? "bg-status-safe"
      : type === "P.A."
        ? "bg-status-reach"
        : "bg-fg-subtle";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 py-0.5 font-mono text-[11px] font-bold tracking-wide ${tone}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      {type || "—"}
    </span>
  );
}

/**
 * The accredited-programme table, grown a batch at a time.
 *
 * The original renders all 5,587 rows into the DOM at once and lets the browser
 * cope. Each batch here is fetched when it is asked for, so a reader who
 * filters to one city never pays for the other 91.
 *
 * ## Resetting
 *
 * Filters are URL state, so changing one is a same-route navigation: the server
 * re-renders and hands down a new first batch, but this component stays mounted
 * and would otherwise still be showing the previous filter's rows. The
 * signature is compared during render — an effect would paint the stale table
 * for a frame first.
 */
export function AccreditationTable({
  initial,
  request,
  matched,
  total,
  pageCount,
}: {
  initial: AccreditationRow[];
  /** The filters that produced `initial`, replayed for each further batch. */
  request: Omit<MoreProgramsRequest, "page">;
  /** Programmes matching the filters, across every batch. */
  matched: number;
  /** Programmes in the whole dataset. */
  total: number;
  pageCount: number;
}) {
  const signature = JSON.stringify(request);

  const [rows, setRows] = useState(initial);
  const [page, setPage] = useState(1);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  // Read after mount, not during render. `localStorage` is not available on the
  // server, so seeding state from it directly would make the first client
  // render disagree with the HTML and fail hydration. The cost is one frame in
  // the default format for a reader who has chosen the other one.
  const [dateStyle, setDateStyle] = useState<DateStyle>("readable");
  useEffect(() => {
    const stored = window.localStorage.getItem(DATE_STYLE_KEY);
    if (stored === "register" || stored === "readable") setDateStyle(stored);
  }, []);

  function toggleDateStyle() {
    setDateStyle((prev) => {
      const next = prev === "readable" ? "register" : "readable";
      window.localStorage.setItem(DATE_STYLE_KEY, next);
      return next;
    });
  }

  const seen = useRef(signature);
  if (seen.current !== signature) {
    seen.current = signature;
    setRows(initial);
    setPage(1);
    setFailed(false);
  }

  function loadMore() {
    const next = page + 1;
    startTransition(async () => {
      // The loader returns everything up to the requested page, so the list is
      // replaced rather than concatenated — no chance of a duplicated row if
      // two clicks land close together.
      const result = await moreAccreditedPrograms({ ...request, page: next });
      setRows(result.rows);
      setPage(result.page);
      if (result.rows.length <= rows.length && result.page === page) {
        setFailed(true);
      }
    });
  }

  if (matched === 0) {
    return (
      <Bezel className="mt-3" innerClassName="px-8 py-20 text-center">
        <ArchiveIcon className="mx-auto h-8 w-auto text-fg-subtle" />
        <p className="mt-4 font-sans text-base font-bold text-foreground">
          No accredited programme matches
        </p>
        <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-fg-muted">
          Try a different city or speciality, or clear the hospital search. All{" "}
          {total.toLocaleString("en-GB")} programmes are here — the filters are
          narrower than the data.
        </p>
      </Bezel>
    );
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] text-fg-muted">
          <span className="font-bold text-foreground">
            {matched.toLocaleString("en-GB")}
          </span>{" "}
          {matched === 1 ? "programme" : "programmes"} match
          {matched !== total && (
            <span className="text-fg-subtle">
              {" "}
              · of {total.toLocaleString("en-GB")}
            </span>
          )}
        </p>

        <DateStyleToggle style={dateStyle} onToggle={toggleDateStyle} />
      </div>

      {/* Wide table, so it scrolls inside its own box rather than making the
          page scroll sideways. */}
      <Bezel className="mt-3" innerClassName="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border">
              <Th>Hospital / Institute</Th>
              <Th>City</Th>
              <Th>Speciality</Th>
              <Th>Unit</Th>
              <Th>Type</Th>
              <Th>Since</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={`${row.hospital}|${row.speciality}|${row.unit}|${index}`}
                className="border-b border-border last:border-b-0 hover:bg-surface-sunken"
              >
                <td className="px-4 py-3 text-[13px] font-bold leading-snug text-foreground">
                  {row.hospital}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-fg-muted">
                  {row.city}
                </td>
                {/* Plain text, not `SpecialtyLabel`. That component colours by
                    discipline family, and `familyOf` is built for the seat
                    matrix's 44 specialty names — CPSP publishes 92 of its own,
                    uppercase and differently spelled, of which 75 fall through
                    to the "medical" default. All five dental programmes render
                    as Medical, including the screen-reader label. A wrong
                    family on 5,587 rows is worse than no colour, and the
                    original prints plain text here too. */}
                <td className="px-4 py-3 text-[13px] font-bold leading-snug text-foreground">
                  {row.speciality}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-fg-muted">
                  {row.unit || "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <TypeBadge type={row.type} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] tabular-nums text-fg-muted">
                  {dateStyle === "register"
                    ? row.sinceRaw || "—"
                    : // Falls back to the register's own string rather than a
                      // dash, so an unparseable date still says something.
                      row.since
                      ? formatDate(row.since)
                      : row.sinceRaw || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Bezel>

      {failed ? (
        <p className="mt-6 text-center text-xs text-status-reach">
          Could not load more programmes. Reload the page and try again.
        </p>
      ) : (
        <LoadMore
          shown={rows.length}
          total={matched}
          noun="programmes"
          loading={pending}
          onClick={loadMore}
        />
      )}

      {pageCount > 1 && rows.length < matched && (
        <p className="sr-only" aria-live="polite">
          Batch {page} of {pageCount} loaded.
        </p>
      )}
    </>
  );
}

/**
 * Switches the Since column between this site's format and the register's.
 *
 * A single button rather than a two-option segmented control: there are exactly
 * two states, and a control that shows the state it will move to is smaller and
 * has nothing to mis-click. The label names the format rather than the mode, so
 * it says what the column will look like rather than what the setting is
 * called.
 */
function DateStyleToggle({
  style,
  onToggle,
}: {
  style: DateStyle;
  onToggle: () => void;
}) {
  const { ref: icon, handlers } = useActionIcon();

  return (
    <button
      type="button"
      onClick={onToggle}
      {...handlers}
      aria-pressed={style === "register"}
      className="flex items-center gap-2 rounded-sm border border-border-strong px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted transition-colors hover:border-accent hover:text-foreground"
    >
      <Calendar03Icon ref={icon} size={ICON_SIZE_SM} aria-hidden />
      {style === "readable" ? "Dates as CPSP writes them" : "Dates in full"}
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
      {children}
    </th>
  );
}
