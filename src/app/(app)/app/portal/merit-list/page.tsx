import type { Metadata } from "next";
import { Suspense } from "react";
import { loadMeritList, loadRounds, type ConsentState } from "@/lib/portal/merit-list";
import { loadSeats } from "@/lib/portal/data";
import { MeritListControls } from "@/components/portal/merit-list-controls";
import { MeritSlotList } from "@/components/portal/merit-slot-list";
import { TidbitsPanel } from "@/components/portal/tidbits-panel";
import { SimulationProvider } from "@/components/portal/simulation-provider";
import { SimulationBar } from "@/components/portal/simulation-bar";
import { FindMeBar } from "@/components/portal/find-me-bar";
import { PortalQuoteStrip } from "@/components/portal/quote-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { Term } from "@/components/portal/portal-terms";
import { AlertIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Merit List | Induction Portal | MeritNama",
  description:
    "The published merit list for a round, seat by seat, with consent status and who is next in line for each.",
};

const CONSENT_VALUES: ConsentState[] = ["Accepted", "Excluded", "Awaited"];

/**
 * The portal's Merit List.
 *
 * The same rows `/app/merit-lists` renders as a flat table, grouped by SEAT
 * instead of by person. That regrouping is the whole point: the flat table
 * answers "where does this candidate appear", and this answers "who is in this
 * seat, and who is behind them" — which is the question during a live cycle.
 *
 * Round is the only filter that reloads: everything else narrows a set already
 * fetched. Round changes which published snapshot is being read.
 */
export default async function PortalMeritListPage({
  searchParams,
}: {
  searchParams: Promise<{
    round?: string;
    program?: string;
    specialty?: string;
    hospital?: string;
    quota?: string;
    consent?: string;
    q?: string;
  }>;
}) {
  const params = await searchParams;
  const rounds = await loadRounds();

  // Default to the latest published round, which is the one people are looking
  // at during a cycle. Falling back to round 1 would show a snapshot months old.
  const requested = Number(params.round);
  const round =
    Number.isFinite(requested) && rounds.includes(requested)
      ? requested
      : (rounds[rounds.length - 1] ?? 1);

  const consent = CONSENT_VALUES.includes(params.consent as ConsentState)
    ? (params.consent as ConsentState)
    : undefined;

  const view = await loadMeritList({
    round,
    program: params.program,
    specialty: params.specialty,
    hospital: params.hospital,
    quota: params.quota,
    consent,
    search: params.q,
    // Always the first batch. Further pages are fetched by the client and
    // appended, so there is no `?page=` in the URL to land a reader halfway
    // down a list with nothing above it.
    page: 1,
    rounds,
  });

  // The preference editor cascades programme to quota to specialty to hospital
  // over the real seat list, so it cannot produce a seat that does not exist.
  // 873 rows of four short strings; cached server-side and shared with every
  // other portal surface.
  const seatOptions = (await loadSeats()).map((seat) => ({
    program: seat.program,
    quota: seat.quota,
    specialty: seat.specialty,
    hospital: seat.hospital,
  }));

  const { summary } = view;
  const hasTidbits =
    view.tidbits.multiTrack.length > 0 || view.tidbits.multiProgramme.length > 0;

  return (
    <div>
      <PortalQuoteStrip />

      <div className="mx-auto max-w-[1600px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <Eyebrow>Induction Portal</Eyebrow>

          <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl text-balance">
            Merit list,{" "}
            <span className="text-accent">round {round}</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            The published placements for this round, one card per seat,
            with each occupant’s consent decision and who is next in line.
          </p>
        </Reveal>

        <Bezel
          className="mt-12"
          innerClassName="grid grid-cols-2 overflow-clip sm:grid-cols-3 lg:grid-cols-6"
        >
          <Meta label="Round" value={String(summary.round)} />
          <Meta label="Entries" value={summary.total.toLocaleString("en-GB")} />
          <Meta
            label="Accepted"
            value={summary.accepted.toLocaleString("en-GB")}
            tone="text-status-safe"
          />
          <Meta
            label="Excluded"
            value={summary.excluded.toLocaleString("en-GB")}
            tone="text-status-danger"
          />
          <Meta
            label="Awaited"
            value={summary.awaited.toLocaleString("en-GB")}
            tone="text-status-reach"
          />
          <Meta
            label="Seats"
            value={summary.seats.toLocaleString("en-GB")}
            hint={`${summary.slots} slots`}
          />
        </Bezel>

        {/* The legend the live page prints under its counters. The three words
            are the vocabulary of every card below. */}
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-fg-muted">
          <span>
            <Term tone="safe">Accepted</Term> — consented to this slot
          </span>
          <span>
            <Term tone="danger">Excluded</Term> — rejected, dropped, or accepted
            elsewhere
          </span>
          <span>
            <Term tone="reach">Awaited</Term> — awaiting decision
          </span>
        </p>

        {/* The live portal carries this warning on rounds it generates from
            consent data rather than the gazette. Ours are ingested from the
            published files, but the caution is the same one and belongs here
            for the same reason: people make irreversible choices on this. */}
        <FindMeBar seats={seatOptions} />

        <Bezel className="mt-6" innerClassName="flex items-start gap-3 p-4">
          <AlertIcon className="mt-0.5 h-4 w-auto shrink-0 text-status-reach" />
          <p className="text-xs leading-relaxed text-fg-muted">
            <span className="font-bold text-status-reach">
              Confirm against the official gazette.
            </span>{" "}
            This view is built from the published merit and consent files. It
            cannot see grievance outcomes, eligibility rulings or manual
            corrections applied after publication, so it may differ from the
            posted list. Do not make a decision on this alone.
          </p>
        </Bezel>

        {/* The sidebar only exists when a round HAS multi-track or
            multi-programme candidates — round 7 has neither. The grid template
            has to follow, or the main column silently inherits the 17rem
            sidebar track and the whole page renders squashed into it. Fixed by
            deciding the layout here rather than letting a child's null collapse
            it. */}
        {/* The provider wraps the grid AND the bar: the bar reads the edits
            made on the cards, so they have to share one state. */}
        <SimulationProvider round={round}>
        <div
          className={`mt-6 grid gap-6 xl:items-start ${
            hasTidbits ? "xl:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]" : ""
          }`}
        >
          {hasTidbits && <TidbitsPanel tidbits={view.tidbits} />}

          <div className="min-w-0">
            <Suspense fallback={null}>
              <MeritListControls
                round={round}
                rounds={summary.rounds}
                facets={view.facets}
                selected={{
                  program: params.program ?? "",
                  specialty: params.specialty ?? "",
                  hospital: params.hospital ?? "",
                  quota: params.quota ?? "",
                  consent: consent ?? "",
                  search: params.q ?? "",
                }}
              />
            </Suspense>

            <SimulationBar />

            {/* The grid grows in place. `request` is the filter set that
                produced this first page, replayed by the client for each
                further batch — so a "load more" can never quietly widen what
                is being asked for. */}
            <MeritSlotList
              initial={view.slots}
              request={{
                round,
                program: params.program,
                specialty: params.specialty,
                hospital: params.hospital,
                quota: params.quota,
                consent,
                search: params.q,
              }}
              pageCount={view.pageCount}
              matched={view.matchedSlots}
              total={view.totalSlots}
            />
          </div>
        </div>
        </SimulationProvider>
      </div>
    </div>
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
    <div className="-ml-px -mt-px border-l border-t border-border bg-surface p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
        {label}
      </p>
      <p className={`mt-1 font-mono text-lg font-bold tabular-nums ${tone}`}>
        {value}
        {hint && (
          <span className="ml-1.5 text-[10px] font-normal text-fg-subtle">{hint}</span>
        )}
      </p>
    </div>
  );
}
