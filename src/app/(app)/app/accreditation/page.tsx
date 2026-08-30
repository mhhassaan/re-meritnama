import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { loadAccreditation } from "@/lib/accreditation/data";
import { AccreditationControls } from "@/components/accreditation/accreditation-controls";
import { AccreditationTable } from "@/components/accreditation/accreditation-table";
import { VerseStrip } from "@/components/app/verse-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { AlertIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Accredited Programs | MeritNama",
  description:
    "CPSP accreditation for FCPS training, searchable by hospital, city or speciality.",
};

/**
 * CPSP Accredited Programs.
 *
 * The original's framing, kept: "Official FCPS accreditation data from CPSP —
 * search by hospital, city, or speciality."
 *
 * No table, no policy, no ingest. `public/data/cpsp_accreditation.json` was
 * already in the repo, and it is the one dataset here with no personal data in
 * it at all — see `@/lib/accreditation/data` for what that changes.
 */
export default async function AccreditationPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    city?: string;
    speciality?: string;
    type?: string;
  }>;
}) {
  const params = await searchParams;

  const request = {
    search: params.q ?? "",
    city: params.city ?? "",
    speciality: params.speciality ?? "",
    type: params.type ?? "",
  };

  const view = await loadAccreditation(request);
  const { stats } = view;

  return (
    <div>
      <VerseStrip />

      <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <Eyebrow>Reference</Eyebrow>

          <h1 className="mt-6 max-w-[16ch] font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl">
            Where FCPS
            <span className="block text-accent">can be trained</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            CPSP’s accreditation register —{" "}
            <span className="font-mono font-bold text-foreground">
              {stats.programs.toLocaleString("en-GB")}
            </span>{" "}
            accredited programmes across{" "}
            <span className="font-mono font-bold text-foreground">
              {stats.hospitals.toLocaleString("en-GB")}
            </span>{" "}
            institutions. A seat on the induction merit list and an accredited
            unit are two different facts, and this is the second one.
          </p>
        </Reveal>

        <Bezel
          className="mt-12"
          innerClassName="grid grid-cols-2 gap-px bg-border sm:grid-cols-4"
        >
          <Meta
            label="Accredited programmes"
            value={stats.programs.toLocaleString("en-GB")}
          />
          <Meta
            label="Hospitals"
            value={stats.hospitals.toLocaleString("en-GB")}
          />
          <Meta label="Cities" value={stats.cities.toLocaleString("en-GB")} />
          <Meta
            label="Specialities"
            value={stats.specialities.toLocaleString("en-GB")}
          />
        </Bezel>

        {/* ── What the codes are, as a distribution rather than a glossary ──
            CPSP publishes F.A., P.A. and T.A. against each unit and this
            dataset carries no key for them, so nothing here expands them —
            inventing the words would be worse than printing the code. What can
            honestly be said is how lopsided the register is. */}
        <Bezel className="mt-3" innerClassName="p-5">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
            Accreditation types in the register
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {stats.byType.map((entry) => (
              <span
                key={entry.type}
                className="flex items-baseline gap-2 rounded-sm border border-border-strong px-3 py-1.5"
              >
                <span className="font-mono text-[11px] font-bold text-foreground">
                  {entry.type}
                </span>
                <span className="font-mono text-[10px] tabular-nums text-fg-muted">
                  {entry.count.toLocaleString("en-GB")}
                </span>
              </span>
            ))}
          </div>

          <p className="mt-4 max-w-3xl text-xs leading-relaxed text-fg-subtle">
            The register does not publish a key for these codes and neither does
            the official page, so they are printed as CPSP wrote them rather than
            expanded into words we would be guessing at. The practical shape is
            the distribution:{" "}
            <span className="font-mono font-bold text-foreground">
              {stats.byType[0]?.type}
            </span>{" "}
            covers{" "}
            {((stats.byType[0]?.count ?? 0) / Math.max(1, stats.programs) * 100).toFixed(
              1
            )}
            % of every accredited unit in the country.
          </p>
        </Bezel>

        {/* ── What a row is ────────────────────────────────────────────────
            Stated before the table rather than as a footnote, because a reader
            who filters to one speciality in one city and counts the rows will
            otherwise over-count the units available to them. */}
        <Bezel className="mt-3" innerClassName="flex items-start gap-3 p-5">
          <AlertIcon className="mt-0.5 h-4 w-auto shrink-0 text-status-reach" />
          <p className="text-sm leading-relaxed text-fg-muted">
            <span className="font-bold text-status-reach">
              A row is a register entry, not a training unit.
            </span>{" "}
            {stats.duplicateRows} rows are identical to another row, and some
            institutions are listed under several spellings — King Edward
            appears three ways, each carrying Cardiology Unit-I from the same
            date. Neither is corrected here: collapsing them means choosing a
            canonical name CPSP has not chosen, and the counts would then stop
            agreeing with the official register for a reason you could not see.
          </p>
        </Bezel>

        <Suspense fallback={null}>
          <AccreditationControls
            facets={view.facets}
            selected={{
              search: request.search,
              city: request.city,
              speciality: request.speciality,
              type: request.type,
            }}
          />
        </Suspense>

        <AccreditationTable
          initial={view.rows}
          request={request}
          matched={view.matched}
          total={view.total}
          pageCount={view.pageCount}
        />

        <p className="mt-16 flex items-start gap-2.5 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          <AlertIcon className="mt-px h-4 w-auto shrink-0 text-status-reach" />
          <span>
            <span className="font-bold text-status-reach">
              This is a periodic scrape, not a live feed.
            </span>{" "}
            Accreditation is granted, renewed and withdrawn continuously, and a
            unit that lapsed last week still reads as accredited here. Confirm on
            CPSP’s own register before choosing a preference on the
            strength of it. Unit numbers are printed exactly as published, which
            is why both <span className="font-mono">Unit-I</span> and{" "}
            <span className="font-mono">Unit-1</span> appear — the inconsistency
            is CPSP’s and correcting it here would misquote the source.
            Accreditation is also not the same question as{" "}
            <Link
              href="/app/portal/hospitals"
              className="font-bold text-accent underline"
            >
              seats in this induction
            </Link>
            : a unit can be accredited and offer nothing this cycle.
          </span>
        </p>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-bold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
