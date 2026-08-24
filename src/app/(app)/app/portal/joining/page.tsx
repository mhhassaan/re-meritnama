import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { loadJoining } from "@/lib/portal/joining";
import { FINAL_ROUND } from "@/lib/portal/rounds";
import { JoiningSlotCard } from "@/components/portal/joining-slot-card";
import { JoiningControls } from "@/components/portal/joining-controls";
import { PortalQuoteStrip } from "@/components/portal/quote-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { AlertIcon, ArchiveIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Joining Status | Induction Portal | MeritNama",
  description:
    "Who has actually reported to their allocated seat, from the final seat-allocation export.",
};

/**
 * Joining Status.
 *
 * The original's framing, kept: "Who has actually reported to their selected
 * seat, from the final seat-allocation export." A seat on a merit list is not
 * a doctor in a hospital, and the difference is the last thing a candidate
 * waiting on a vacancy wants to know.
 */
export default async function JoiningStatusPage({
  searchParams,
}: {
  searchParams: Promise<{
    program?: string;
    specialty?: string;
    hospital?: string;
    quota?: string;
    q?: string;
    status?: string;
  }>;
}) {
  const params = await searchParams;

  const view = await loadJoining({
    program: params.program,
    specialty: params.specialty,
    hospital: params.hospital,
    quota: params.quota,
    search: params.q,
    status: params.status,
  });

  if (!view.ok) {
    return (
      <div>
        <PortalQuoteStrip />
        <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
          <Eyebrow>Induction Portal</Eyebrow>
          <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em]">
            Joining Status
          </h1>
          <Bezel className="mt-8" innerClassName="flex items-start gap-3 p-5">
            <AlertIcon className="mt-0.5 h-4 w-auto shrink-0 text-status-reach" />
            <p className="text-sm leading-relaxed text-fg-muted">
              <span className="font-bold text-status-reach">
                Verify your identity first.
              </span>{" "}
              The joining export is only readable once your account is verified.{" "}
              <Link href="/app" className="font-bold text-accent underline">
                Start here
              </Link>
              .
            </p>
          </Bezel>
        </div>
      </div>
    );
  }

  const { summary } = view;

  return (
    <div>
      <PortalQuoteStrip />

      <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <Eyebrow>Induction Portal</Eyebrow>

          <h1 className="mt-6 max-w-[16ch] font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl">
            Who actually
            <span className="block text-accent">turned up</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            Who has reported to their selected seat, from the final
            seat-allocation export —{" "}
            <span className="font-mono font-bold text-foreground">
              {summary.tracked.toLocaleString("en-GB")}
            </span>{" "}
            candidates tracked. A seat on a merit list is not a doctor in a
            hospital, and this is where the two stop agreeing.
          </p>
        </Reveal>

        <Bezel
          className="mt-12"
          innerClassName="grid grid-cols-2 gap-px bg-border sm:grid-cols-4"
        >
          <Meta label="Tracked" value={summary.tracked.toLocaleString("en-GB")} />
          <Meta
            label="Joined"
            value={summary.joined.toLocaleString("en-GB")}
            tone="text-status-safe"
          />
          <Meta
            label="Not joined"
            value={summary.notJoined.toLocaleString("en-GB")}
            tone={summary.notJoined ? "text-status-reach" : "text-fg-subtle"}
          />
          <Meta
            label="Seats with nobody"
            value={summary.emptySlots.toLocaleString("en-GB")}
            hint={`${summary.slots} tracked`}
            tone={summary.emptySlots ? "text-status-danger" : "text-fg-subtle"}
          />
        </Bezel>

        {/* The live portal splits "not joined" into "within window" and "likely
            wasted". The export carries no field that separates them, and its own
            counter puts every pending candidate in the first bucket — so rather
            than invent a threshold, the deadline is printed against each person
            and the reader can see it. */}
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-fg-subtle">
          The official portal splits &ldquo;not joined&rdquo; into{" "}
          <em>within window</em> and <em>likely wasted</em>. Nothing in the
          export distinguishes them, so each candidate&rsquo;s deadline is shown
          on their row instead of a bucket derived from a rule we would be
          guessing at.
        </p>

        {/* ── Seats nobody appears against ──────────────────────────────── */}
        {view.empty.length > 0 && (
          <Bezel className="mt-8" innerClassName="p-5">
            <div className="flex items-center gap-2.5">
              <AlertIcon className="h-4 w-auto shrink-0 text-status-danger" />
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-status-danger">
                {view.empty.length} seats from round {FINAL_ROUND} have nobody in
                the export
              </p>
            </div>

            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-fg-muted">
              These had candidates placed in the final merit round —{" "}
              {summary.strandedPlacements.toLocaleString("en-GB")} people in
              total — and none of them appears anywhere in the joining export.
              That reads as the seat being vacated outright rather than
              allocated to someone who then failed to report, which are two
              different things for anyone waiting on it.
            </p>

            <ul className="mt-4 flex flex-col gap-1.5">
              {view.empty.slice(0, EMPTY_SHOWN).map((slot) => (
                <li
                  key={`${slot.program}|${slot.specialty}|${slot.hospital}|${slot.quota}`}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px]"
                >
                  <span className="min-w-0 flex-1 truncate text-foreground">
                    {slot.specialty} @ {slot.hospital}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-fg-subtle">
                    {slot.program} · {slot.quota}
                  </span>
                  <span className="w-40 shrink-0 text-right font-mono text-[10px] tabular-nums text-status-danger">
                    {slot.placed} in round {FINAL_ROUND}, 0 joined
                  </span>
                </li>
              ))}
            </ul>

            {view.empty.length > EMPTY_SHOWN && (
              <p className="mt-3 font-mono text-[10px] text-fg-subtle">
                …and {view.empty.length - EMPTY_SHOWN} more
              </p>
            )}
          </Bezel>
        )}

        <Suspense fallback={null}>
          <JoiningControls
            facets={view.facets}
            selected={{
              program: params.program ?? "",
              specialty: params.specialty ?? "",
              hospital: params.hospital ?? "",
              quota: params.quota ?? "",
              search: params.q ?? "",
              status: params.status ?? "",
            }}
          />
        </Suspense>

        <p className="mt-6 font-mono text-[11px] text-fg-muted">
          <span className="font-bold text-foreground">
            {view.slots.length.toLocaleString("en-GB")}
          </span>{" "}
          of {view.totalSlots.toLocaleString("en-GB")} seats
        </p>

        {view.slots.length === 0 ? (
          <Bezel className="mt-3" innerClassName="px-8 py-20 text-center">
            <ArchiveIcon className="mx-auto h-8 w-auto text-fg-subtle" />
            <p className="mt-4 font-sans text-base font-bold text-foreground">
              No seats match
            </p>
            <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-fg-muted">
              Try a different filter, or clear the search.
            </p>
          </Bezel>
        ) : (
          /* One card per row, not a two-column grid. Grid rows take the height
             of their tallest cell, so a seat holding one candidate sitting
             beside one holding four left a block of dead space under the
             shorter card — and the amount varied down the page, which reads as
             a rendering fault rather than as a layout. */
          <div className="mt-3 flex flex-col gap-4">
            {view.slots.map((slot) => (
              <JoiningSlotCard
                key={`${slot.program}|${slot.specialty}|${slot.hospital}|${slot.quota}`}
                slot={slot}
              />
            ))}
          </div>
        )}

        <p className="mt-16 flex items-start gap-2.5 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          <AlertIcon className="mt-px h-4 w-auto shrink-0 text-status-reach" />
          <span>
            <span className="font-bold text-status-reach">
              A snapshot, not a live feed.
            </span>{" "}
            Joining continues after an export is taken, and PHF applies
            extensions and corrections that no export records. Confirm with the
            institution before treating a seat here as free.
          </span>
        </p>
      </div>
    </div>
  );
}

/**
 * How many empty seats are listed before the count takes over.
 *
 * The original shows a similar handful and then "…and 57 more" — past a certain
 * length the list stops being read and the number is the information.
 */
const EMPTY_SHOWN = 8;

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
