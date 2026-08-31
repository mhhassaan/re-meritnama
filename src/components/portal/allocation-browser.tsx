"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFilterNav } from "@/components/app/use-filter-nav";
import { Bezel } from "@/components/app/bezel";
import { FieldLabel, SearchField, Select } from "@/components/app/field";
import { SpecialtyLabel } from "@/components/merit/merit-badges";
import { SealIcon, TargetIcon } from "@/components/icons/koboyo";
import { LoadMore } from "@/components/portal/load-more";
import { FilterPending } from "@/components/app/filter-pending";
import { useManualCandidate } from "@/components/portal/add-me-modal";
import { allocationWithManual } from "@/lib/portal/allocation-action";
import { MANUAL_ID_BASE } from "@/lib/portal/manual-candidate";

/**
 * The allocation result, seat by seat.
 *
 * The original renders one card per slot with an X/Y badge, the cutoff, the
 * placed candidates, and next in line. That framing is kept — it is the right
 * shape for the question, which is always about one seat at a time.
 *
 * Filtering is client-side because the whole result for a programme is already
 * here and a round trip per keystroke would be slower for no benefit. Changing
 * PROGRAMME is a navigation, because that is a different simulation.
 *
 * ## Why the grid grows a batch at a time
 *
 * FCPS alone is 475 seat cards, which rendered whole came to 2.16 MB of HTML
 * and 15,589 DOM nodes. Unlike the Merit List, the fix here is purely a
 * rendering one: the slots are already props of this component — they have to
 * be, or the filters could not run without a round trip per keystroke — so the
 * payload is unchanged and only the markup is deferred. Nothing is refetched
 * when the reader asks for more.
 */

type Person = {
  applicantId: number;
  name: string | null;
  mark: number;
  preferenceNo: number;
  track: "civilian" | "armed";
};

export type AllocationSlotView = {
  quota: string;
  specialty: string;
  hospital: string;
  capacity: number;
  cutoff: number | null;
  placed: Person[];
  nextInLine: Person | null;
  /** Applicants still genuinely competing here, excluding those placed higher. */
  contenders: number;
};

export function AllocationBrowser({
  program,
  programs,
  stats,
  poolSize,
  slots,
  scopeLabel,
}: {
  program: string;
  programs: string[];
  stats: {
    passes: number;
    competitors: number;
    placed: number;
    unplaced: number;
    seats: number;
    filled: number;
  };
  poolSize: number;
  slots: AllocationSlotView[];
  /**
   * The status scope this run used, from the Config tab.
   *
   * Named rather than assumed: the line below used to say "verified
   * applicants", which stops being true the moment a reader widens the scope
   * past Accepted only — and it is the sentence that tells them whether the
   * numbers mean anything.
   */
  scopeLabel: string;
}) {
  const { go, pending } = useFilterNav();
  const manual = useManualCandidate();

  // The page renders without the manual candidate, because the server cannot
  // read `localStorage` while rendering. When there is one, the allocation is
  // re-run with them in the pool and swapped in. Nobody without an entry waits
  // on a round trip.
  const [withManual, setWithManual] = useState<{
    slots: AllocationSlotView[];
    stats: typeof stats;
    poolSize: number;
    seat: { specialty: string; hospital: string; quota: string } | null;
  } | null>(null);
  const [recomputing, setRecomputing] = useState(false);

  useEffect(() => {
    if (!manual?.preferences.length) {
      setWithManual(null);
      return;
    }
    let live = true;
    setRecomputing(true);
    allocationWithManual(program, manual)
      .then((result) => {
        if (!live || !result.ok) return;
        setWithManual({
          slots: result.slots,
          stats: result.stats,
          poolSize: result.poolSize,
          seat: result.manualSeat,
        });
      })
      .finally(() => live && setRecomputing(false));
    return () => {
      live = false;
    };
  }, [manual, program]);

  const activeSlots = withManual?.slots ?? slots;
  const activeStats = withManual?.stats ?? stats;
  const activePool = withManual?.poolSize ?? poolSize;

  const [search, setSearch] = useState("");
  const [quota, setQuota] = useState("");
  const [onlyUnfilled, setOnlyUnfilled] = useState(false);

  const quotas = useMemo(
    () =>
      [...new Set(activeSlots.map((s) => s.quota))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [activeSlots],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return activeSlots.filter((slot) => {
      if (quota && slot.quota !== quota) return false;
      if (onlyUnfilled && slot.placed.length >= slot.capacity) return false;
      if (!term) return true;
      return (
        slot.specialty.toLowerCase().includes(term) ||
        slot.hospital.toLowerCase().includes(term) ||
        slot.placed.some(
          (p) =>
            p.name?.toLowerCase().includes(term) ||
            String(p.applicantId).includes(term),
        )
      );
    });
  }, [activeSlots, search, quota, onlyUnfilled]);

  // Filtering resets the batch. Narrowing to twelve seats and still being shown
  // a "Load more" — or worse, keeping a scroll position from a list that no
  // longer exists — reads as the filter having failed.
  const [shown, setShown] = useState(BATCH);
  const signature = `${quota}|${onlyUnfilled}|${search.trim().toLowerCase()}|${program}`;
  const seen = useRef(signature);
  if (seen.current !== signature) {
    seen.current = signature;
    setShown(BATCH);
  }

  return (
    // Dimmed rather than blanked while a new programme loads: the numbers on
    // screen are still the true answer for the programme that produced them,
    // and swapping them for a skeleton is what makes a filter read as a reload.
    <FilterPending pending={pending}>
      <Bezel
        className="mt-12"
        innerClassName="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-6"
      >
        <Meta label="Programme" value={program} />
        <Meta label="Seats" value={activeStats.seats.toLocaleString("en-GB")} />
        <Meta
          label="Filled"
          value={activeStats.filled.toLocaleString("en-GB")}
          tone="text-status-safe"
        />
        <Meta
          label="Unfilled"
          value={(activeStats.seats - activeStats.filled).toLocaleString(
            "en-GB",
          )}
          tone="text-status-reach"
        />
        <Meta
          label="Competing"
          value={activeStats.competitors.toLocaleString("en-GB")}
          hint="entries"
        />
        <Meta label="Passes" value={String(activeStats.passes)} />
      </Bezel>

      {/* The pool is the number that decides whether any of this means
          anything, so it is stated rather than buried in a tooltip. */}
      <p className="mt-3 font-mono text-[11px] leading-relaxed text-fg-subtle">
        Simulated over {activePool.toLocaleString("en-GB")} applicants under{" "}
        <span className="font-bold text-foreground">{scopeLabel}</span> — the
        whole cycle’s pool, not only those who placed.
      </p>

      {manual?.preferences.length ? (
        <p className="mt-3 flex flex-wrap items-baseline gap-x-2 font-mono text-[11px] text-fg-subtle">
          {recomputing ? (
            <span>Re-running with your manual entry…</span>
          ) : withManual ? (
            <>
              <span className="font-bold text-hope">
                Including your manual entry.
              </span>
              <span>
                {withManual.seat
                  ? `Placed at ${withManual.seat.specialty} @ ${withManual.seat.hospital} (${withManual.seat.quota}).`
                  : "Not placed in this run."}
              </span>
            </>
          ) : null}
        </p>
      ) : null}

      <Bezel className="mt-6" innerClassName="p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 xl:items-end">
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="alloc-program">Programme</FieldLabel>
            <Select
              id="alloc-program"
              value={program}
              onChange={(e) =>
                go(
                  `/app/portal/allocation?program=${encodeURIComponent(e.target.value)}`,
                )
              }
            >
              {programs.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="alloc-quota">Quota</FieldLabel>
            <Select
              id="alloc-quota"
              value={quota}
              onChange={(e) => setQuota(e.target.value)}
            >
              <option value="">All quotas</option>
              {quotas.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="alloc-search">Search</FieldLabel>
            <SearchField
              id="alloc-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Specialty, hospital, name or ID…"
            />
          </div>

          <label className="flex min-h-[46px] cursor-pointer items-center gap-2.5 text-sm text-foreground">
            <input
              type="checkbox"
              checked={onlyUnfilled}
              onChange={(e) => setOnlyUnfilled(e.target.checked)}
              className="h-4 w-4 rounded-sm border-border-strong accent-[var(--accent-strong)]"
            />
            Unfilled seats only
          </label>
        </div>
      </Bezel>

      {/* The match count describes the filter, never the batch on screen. */}
      <p className="mt-6 font-mono text-[11px] text-fg-muted">
        <span className="font-bold text-foreground">
          {visible.length.toLocaleString("en-GB")}
        </span>{" "}
        of {activeSlots.length.toLocaleString("en-GB")} seats
      </p>

      {visible.length === 0 ? (
        <Bezel className="mt-3" innerClassName="px-8 py-20 text-center">
          <SealIcon className="mx-auto h-8 w-auto text-fg-subtle" />
          <p className="mt-4 font-sans text-base font-bold text-foreground">
            No seats match
          </p>
          <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-fg-muted">
            Try a different quota, or clear the search.
          </p>
        </Bezel>
      ) : (
        <>
          <div className="mt-3 grid gap-px bg-border lg:grid-cols-2 2xl:grid-cols-3">
            {visible.slice(0, shown).map((slot) => (
              <SlotCard
                key={`${slot.specialty}|${slot.hospital}|${slot.quota}`}
                slot={slot}
              />
            ))}
          </div>

          <LoadMore
            shown={Math.min(shown, visible.length)}
            total={visible.length}
            onClick={() => setShown((n) => n + BATCH)}
          />
        </>
      )}
    </FilterPending>
  );
}

/**
 * Seat cards per batch.
 *
 * Twelve rows of the widest grid, which is well past a screenful — the reader
 * scrolls before they ever reach the button.
 */
const BATCH = 36;

function SlotCard({ slot }: { slot: AllocationSlotView }) {
  const full = slot.placed.length >= slot.capacity;

  return (
    // A cell in the hairline grid above: opaque, so the grid colour shows only
    // in the seams between cells.
    <div className="flex h-full flex-col bg-background p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <SpecialtyLabel specialty={slot.specialty} className="text-[13px]" />
          <p className="mt-1 text-xs leading-snug text-fg-muted">
            {slot.hospital}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-fg-subtle">
            {slot.quota}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-sm border px-2 py-1 font-mono text-[11px] font-bold tabular-nums ${
            full
              ? "border-status-safe/50 text-status-safe"
              : "border-status-reach/50 text-status-reach"
          }`}
          title={full ? "Every seat filled" : "Seats remain"}
        >
          {slot.placed.length}/{slot.capacity}
        </span>
      </div>

      <div className="mt-4 flex items-baseline gap-2 border-y border-border py-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
          Cutoff
        </span>
        {/* No cutoff for a seat that did not fill — there was no threshold
            anyone had to clear, and printing the lowest placed mark would
            invent one. */}
        {slot.cutoff != null ? (
          <span className="font-mono text-lg font-bold tabular-nums text-accent">
            {slot.cutoff.toFixed(2)}
          </span>
        ) : (
          <span className="font-mono text-xs text-fg-subtle">
            — seat did not fill
          </span>
        )}
      </div>

      <ol className="mt-3 flex flex-col gap-1.5">
        {slot.placed.map((person, i) => (
          <li
            key={`${person.applicantId}-${person.track}`}
            className={`flex items-baseline gap-2 rounded-sm text-[13px] ${
              person.applicantId === MANUAL_ID_BASE
                ? "-mx-1.5 bg-hope/10 px-1.5 py-0.5 ring-1 ring-hope/40"
                : ""
            }`}
          >
            <span className="w-4 shrink-0 font-mono text-[10px] tabular-nums text-fg-subtle">
              {i + 1}
            </span>
            <Name person={person} />
            <span className="ml-auto shrink-0 font-mono text-xs font-bold tabular-nums text-foreground">
              {person.mark.toFixed(2)}
            </span>
          </li>
        ))}
      </ol>

      {slot.nextInLine && (
        <div className="mt-4 flex items-baseline gap-2 rounded-sm bg-surface-sunken/50 px-3 py-2 text-[13px]">
          <TargetIcon className="h-3.5 w-auto shrink-0 self-center text-fg-subtle" />
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
            Next
          </span>
          <Name person={slot.nextInLine} />
          <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-fg-muted">
            {slot.nextInLine.mark.toFixed(2)}
          </span>
        </div>
      )}

      <p className="mt-3 font-mono text-[10px] text-fg-subtle">
        {slot.contenders.toLocaleString("en-GB")} still competing
      </p>
    </div>
  );
}

/**
 * A person, named only where the gazette already named them.
 *
 * An applicant who never placed in a published round has no public name, so
 * they show as an id. That is the honest rendering — filling the gap would mean
 * this project publishing something nobody else has.
 */
function Name({ person }: { person: Person }) {
  return (
    <span className="min-w-0 truncate">
      {person.name ? (
        <span className="font-bold text-foreground">{person.name}</span>
      ) : (
        <span
          className="font-mono text-xs text-fg-muted"
          title="Not named in any published merit list"
        >
          #{person.applicantId}
        </span>
      )}
      <span className="ml-1.5 font-mono text-[10px] text-fg-subtle">
        P{person.preferenceNo}
        {person.track === "armed" && " · AF"}
      </span>
    </span>
  );
}

function Meta({
  label,
  value,
  hint,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="bg-surface p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
        {label}
      </p>
      <p className={`mt-1 font-mono text-lg font-bold tabular-nums ${tone}`}>
        {value}
        {hint && (
          <span className="ml-1.5 text-[10px] font-normal text-fg-subtle">
            {hint}
          </span>
        )}
      </p>
    </div>
  );
}
