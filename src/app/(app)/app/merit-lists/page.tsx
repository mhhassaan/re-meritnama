import type { Metadata } from "next";
import { Suspense } from "react";
import {
  loadAvailableCycles,
  loadConsentBreakdown,
  loadListFacets,
  loadMeritList,
} from "@/lib/merit-lists/data";
import { MeritListControls } from "@/components/merit-lists/merit-list-controls";
import { VerseStrip } from "@/components/app/verse-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { ArchiveIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Previous Merit Lists | MeritNama",
  description:
    "Browse candidate-level merit data from previous induction cycles, organised by round.",
};

/**
 * Previous Merit Lists — Tier 1 candidate data, per cycle and round.
 *
 * The one page in the app that reads candidate records rather than aggregates.
 * Everything is fetched **as the signed-in user**, so Row Level Security is
 * what decides visibility; nothing here filters by identity in application
 * code. That is deliberate, and it is why this page can show names at all.
 *
 * What it does NOT show: contact details. Those live on `candidates` (Tier 2)
 * and are not in this projection, so a merit list cannot leak a phone number
 * even if the query changed.
 */
export default async function MeritListsPage({
  searchParams,
}: {
  searchParams: Promise<{
    induction?: string;
    round?: string;
    program?: string;
    quota?: string;
    q?: string;
  }>;
}) {
  const params = await searchParams;
  const cycles = await loadAvailableCycles();

  const induction = Number(params.induction);
  const round = Number(params.round);
  const hasSelection =
    Number.isFinite(induction) && Number.isFinite(round) && induction > 0 && round > 0;

  const [list, facets, breakdown] = hasSelection
    ? await Promise.all([
        loadMeritList({
          induction,
          round,
          program: params.program,
          quota: params.quota,
          search: params.q,
        }),
        loadListFacets(induction, round),
        loadConsentBreakdown(induction, round),
      ])
    : [
        { entries: [], total: 0 },
        { programs: [], quotas: [] },
        { total: 0, accepted: 0, rejected: 0, awaited: 0 },
      ];

  const cycle = cycles.find((c) => c.induction === induction);
  const cycleLabel = cycle?.labelWithInduction ?? cycle?.label;

  return (
    <div>
      <VerseStrip />

      <div className="mx-auto max-w-[1600px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <Eyebrow>Previous Merit Lists</Eyebrow>

          <h1 className="mt-6 max-w-[18ch] font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl">
            Merit lists,
            <span className="block text-accent">round by round</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            Browse candidate-level merit data from previous induction cycles,
            organised by round.
          </p>
        </Reveal>

        <Bezel className="mt-12" innerClassName="p-5">
          <Suspense fallback={null}>
            <MeritListControls
              cycles={cycles}
              programs={facets.programs}
              quotas={facets.quotas}
            />
          </Suspense>
        </Bezel>

        {!hasSelection ? (
          <Bezel className="mt-6" innerClassName="px-8 py-20 text-center">
            <ArchiveIcon className="mx-auto h-8 w-auto text-fg-subtle" />
            <p className="mt-4 font-sans text-base font-bold text-foreground">
              No merit list loaded yet
            </p>
            <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-fg-muted">
              Select an induction cycle and round above, then choose Load to
              view candidate-level merit data.
            </p>
          </Bezel>
        ) : list.entries.length === 0 ? (
          <Bezel className="mt-6" innerClassName="px-8 py-20 text-center">
            <p className="font-sans text-base font-bold text-foreground">
              Nothing to show for {cycleLabel ?? "this cycle"}, round {round}
            </p>
            <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-fg-muted">
              Either that round has not been ingested, or the filters exclude
              every entry in it.
            </p>
          </Bezel>
        ) : (
          <>
            {/* The original shows this summary the moment a list loads. The
                counts describe the ROUND as published, not the current filter —
                a total that moved when you picked a programme would be
                answering a different question. */}
            <Bezel className="mt-6" innerClassName="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-6">
              <Meta label="Induction" value={cycleLabel ?? "—"} />
              <Meta label="Round" value={`Round ${round}`} />
              <Meta
                label="Total"
                value={breakdown.total.toLocaleString("en-GB")}
                hint="candidates"
              />
              <Meta
                label="Accepted"
                value={breakdown.accepted.toLocaleString("en-GB")}
                tone="text-status-safe"
              />
              <Meta
                label="Rejected"
                value={breakdown.rejected.toLocaleString("en-GB")}
                tone="text-status-danger"
              />
              <Meta
                label="Awaited"
                value={breakdown.awaited.toLocaleString("en-GB")}
                tone="text-status-reach"
              />
            </Bezel>

            {/* The whole round, not a slice of it. This used to show the
                first 500 and say so — which meant that on round 8, 59% of the
                people on the list could not find themselves and would conclude
                they were not on it. */}
            <p className="mt-6 font-mono text-[11px] text-fg-muted">
              <span className="font-bold text-foreground">
                {list.entries.length.toLocaleString("en-GB")}
              </span>{" "}
              entries · {cycleLabel} · round {round}
            </p>

            <div className="mt-3 rounded-lg bg-surface-sunken/70 p-1 shadow-ambient ring-1 ring-border">
              <div className="overflow-x-auto rounded-[0.25rem] bg-surface shadow-[inset_0_1px_0_var(--edge-highlight)]">
                <table className="w-full border-collapse text-sm">
                  <caption className="sr-only">
                    Merit list for {cycleLabel}, round {round}, in published order.
                  </caption>
                  <thead className="sticky top-0 z-10 bg-surface-sunken">
                    <tr className="border-b border-border">
                      {[
                        "#",
                        "Name",
                        "PMDC",
                        "Specialty",
                        "Hospital",
                        "Program",
                        "Quota",
                        "Marks",
                        "Pref",
                        "Consent",
                      ].map((label, i) => (
                        <th
                          key={label}
                          scope="col"
                          className={`px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-wider text-fg-muted ${
                            i >= 7 ? "text-right" : "text-left"
                          }`}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {list.entries.map((entry, i) => (
                      <tr
                        key={`${entry.applicant_id}-${entry.specialty}-${entry.hospital}`}
                        className={`border-b border-border/60 ${
                          i % 2 === 1 ? "bg-surface-sunken/25" : ""
                        }`}
                      >
                        <td className="px-3 py-2 font-mono text-xs tabular-nums text-fg-subtle">
                          {entry.row_no ?? i + 1}
                        </td>
                        <td className="px-3 py-2 text-[13px] font-bold text-foreground">
                          {entry.name_full}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-fg-muted">
                          {entry.pmdc_no ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-[13px] text-foreground">
                          {entry.specialty}
                        </td>
                        <td className="max-w-[240px] truncate px-3 py-2 text-[13px] text-fg-muted" title={entry.hospital}>
                          {entry.hospital}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-fg-muted">
                          {entry.program}
                        </td>
                        <td className="max-w-[150px] truncate px-3 py-2 font-mono text-xs text-fg-muted" title={entry.quota}>
                          {entry.quota}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs font-bold tabular-nums text-foreground">
                          {entry.marks_total != null
                            ? Number(entry.marks_total).toFixed(2)
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-fg-muted">
                          {entry.preference_no ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <ConsentBadge status={entry.consent_status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <p className="mt-16 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          Candidate-level data as published in the official merit lists. Names,
          PMDC numbers and marks appear here because the gazette publishes them;
          contact details never do. Verify any figure against the official PHF
          list before relying on it.
        </p>
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

/** Accepted / Rejected / Awaited — the three states the source carries. */
function ConsentBadge({ status }: { status: string | null }) {
  if (!status) return <span className="font-mono text-xs text-fg-subtle">—</span>;

  const tone =
    status === "Accepted"
      ? "border-status-safe/50 text-status-safe"
      : status === "Rejected"
        ? "border-status-danger/50 text-status-danger"
        : "border-status-reach/50 text-status-reach";

  return (
    <span
      className={`inline-flex w-[5.5rem] items-center justify-center rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${tone}`}
    >
      {status}
    </span>
  );
}
