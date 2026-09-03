import type { Metadata } from "next";
import { Suspense } from "react";
import { loadCompetition, type CompetitionSort } from "@/lib/portal/competition";
import { CompetitionControls } from "@/components/portal/competition-controls";
import { SpecialtyLabel } from "@/components/merit/merit-badges";
import { PortalQuoteStrip } from "@/components/portal/quote-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { AlertIcon, ArchiveIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Competition | Induction Portal | MeritNama",
  description:
    "How many candidates applied per seat for each specialty, programme and quota — the demand behind every cutoff.",
};

const SORTS: CompetitionSort[] = ["ratio-desc", "ratio-asc", "specialty", "applicants-desc"];

/**
 * Competition & Demand Index.
 *
 * The original's framing, kept: "See how many candidates applied per seat for
 * each specialty. Higher ratios mean tougher competition." The algorithm is
 * read from the deployed site's own `buildCompetitionData` — see
 * `@/lib/portal/competition` for the full reasoning, including the one
 * deviation: the original's data carries a handful of preferences with no
 * specialty name, rendered there as the literal string "undefined" in a row of
 * its own. Our ingest resolves every specialty id already (see
 * `MISSING_SPECIALTY_IDS`), so that row cannot occur here.
 */
export default async function CompetitionPage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string; quota?: string; q?: string; sort?: string }>;
}) {
  const params = await searchParams;

  const sort = SORTS.includes(params.sort as CompetitionSort)
    ? (params.sort as CompetitionSort)
    : "ratio-desc";

  const view = await loadCompetition({
    program: params.program,
    quota: params.quota,
    search: params.q,
    sort,
  });

  return (
    <div>
      <PortalQuoteStrip />

      <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <Eyebrow>Induction Portal</Eyebrow>

          <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl text-balance">
            Where the{" "}
            <span className="text-accent">demand actually is</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            How many candidates applied per seat. Higher ratios mean tougher
            competition.
          </p>
        </Reveal>

        <Bezel
          className="mt-12"
          innerClassName="grid grid-cols-2 overflow-clip sm:grid-cols-4"
        >
          <Meta label="Combinations" value={view.matched.toLocaleString("en-GB")} />
          <Meta label="Seats" value={view.totalSeats.toLocaleString("en-GB")} />
          <Meta
            label="Applicants"
            value={view.totalApplicants.toLocaleString("en-GB")}
            hint="deduplicated"
          />
          <Meta
            label="Average ratio"
            value={view.averageRatio != null ? `${view.averageRatio.toFixed(1)}:1` : "—"}
          />
        </Bezel>

        {/* The original labels its equivalent count "N specialties shown",
            which is wrong on its own data — the number is rows, and one
            specialty appears in several rows under different programmes and
            quotas. Ours says what it counts. */}
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-fg-subtle">
          A combination is one specialty under one programme and quota. A
          person is counted once even if they listed several hospitals in
          it.
        </p>

        <Suspense fallback={null}>
          <CompetitionControls
            facets={view.facets}
            selected={{
              program: params.program ?? "",
              quota: params.quota ?? "",
              search: params.q ?? "",
              sort,
            }}
          />
        </Suspense>

        <p className="mt-6 font-mono text-[11px] text-fg-muted">
          <span className="font-bold text-foreground">
            {view.matched.toLocaleString("en-GB")}
          </span>{" "}
          of {view.total.toLocaleString("en-GB")} combinations
        </p>

        {view.rows.length === 0 ? (
          <Bezel className="mt-3" innerClassName="px-8 py-20 text-center">
            <ArchiveIcon className="mx-auto h-8 w-auto text-fg-subtle" />
            <p className="mt-4 font-sans text-base font-bold text-foreground">
              No combinations match
            </p>
            <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-fg-muted">
              Try a different programme or quota, or clear the search.
            </p>
          </Bezel>
        ) : (
          <Bezel className="mt-3" innerClassName="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  <Th>Specialty</Th>
                  <Th className="w-24">Programme</Th>
                  <Th className="w-36">Quota</Th>
                  <Th className="w-16 text-right">Seats</Th>
                  <Th className="w-20 text-right">Applicants</Th>
                  <Th className="w-20 text-right">Ratio</Th>
                  <Th className="w-32">Demand</Th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((row) => (
                  <tr
                    key={`${row.specialty}|${row.program}|${row.quota}`}
                    className="border-b border-border/60 last:border-b-0"
                  >
                    <Td>
                      <SpecialtyLabel specialty={row.specialty} className="text-[13px]" />
                    </Td>
                    <Td className="font-mono text-[11px] uppercase tracking-wider text-fg-subtle">
                      {row.program}
                    </Td>
                    <Td className="text-xs text-fg-muted">{row.quota}</Td>
                    <Td className="text-right font-mono text-xs tabular-nums text-foreground">
                      {row.seats}
                    </Td>
                    <Td className="text-right font-mono text-xs tabular-nums text-foreground">
                      {row.applicants}
                    </Td>
                    <Td
                      className={`text-right font-mono text-xs font-bold tabular-nums ${
                        row.tier === "danger"
                          ? "text-status-danger"
                          : row.tier === "reach"
                            ? "text-status-reach"
                            : "text-status-safe"
                      }`}
                    >
                      {Number.isFinite(row.ratio) ? row.ratio.toFixed(1) : "∞"}:1
                    </Td>
                    <Td>
                      <span className="block h-2 w-full overflow-hidden rounded-sm bg-surface-sunken">
                        <span
                          className={`block h-full rounded-sm opacity-70 ${
                            row.tier === "danger"
                              ? "bg-status-danger"
                              : row.tier === "reach"
                                ? "bg-status-reach"
                                : "bg-status-safe"
                          }`}
                          style={{ width: `${row.barWidth}%` }}
                        />
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Bezel>
        )}

        <p className="mt-16 flex items-start gap-2.5 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          <AlertIcon className="mt-px h-4 w-auto shrink-0 text-status-reach" />
          <span>
            Counted over the whole applicant pool, so the Config tab’s
            status scope does not apply here.
          </span>
        </p>
      </div>
    </div>
  );
}

function Meta({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="-ml-px -mt-px border-l border-t border-border bg-surface p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-bold tabular-nums text-foreground">
        {value}
        {hint && (
          <span className="ml-1.5 text-[10px] font-normal text-fg-subtle">{hint}</span>
        )}
      </p>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-fg-muted ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-2.5 text-[13px] ${className}`}>{children}</td>;
}
