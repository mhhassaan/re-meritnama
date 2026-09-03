import type { Metadata } from "next";
import Link from "next/link";
import { loadCandidatePool } from "@/lib/portal/pool";
import { CURRENT_INDUCTION } from "@/lib/induction";
import { loadCycleSummaries } from "@/lib/merit/data";
import { loadRoster, type RosterSort } from "@/lib/portal/directory";
import { RosterTable } from "@/components/portal/roster-table";
import { PoolBands } from "@/components/portal/pool-bands";
import { SeatsByProgram } from "@/components/portal/seats-by-program";
import { PortalQuoteStrip } from "@/components/portal/quote-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { Pill } from "@/components/portal/portal-terms";
import { AlertIcon, ArchiveIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Candidate Pool | Induction Portal | MeritNama",
  description:
    "Everyone competing in the cycle — programmes, verification, marks and preference depth, as counts over the whole pool.",
};

/**
 * The Candidate Pool.
 *
 * The original's version of this tab is a searchable roster: name, marks and
 * programmes per row, click through to the full preference list. **That table
 * is the artefact this rebuild exists to undo**, so this page answers the same
 * questions about the pool without ever returning a person — see
 * `@/lib/portal/pool-stats` for the full reasoning, and the closing note below
 * for the version a reader gets told.
 *
 * The framing above the fold is the original's: the same six counts in its
 * stats bar, and the same verification panel underneath. Where it prints a
 * table, this prints the distribution that table was being scrolled to find.
 */
const SORTS: RosterSort[] = ["marks", "name", "id"];

export default async function CandidatePoolPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    program?: string;
    status?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;

  const status = Number(params.status);
  const sort = SORTS.includes(params.sort as RosterSort)
    ? (params.sort as RosterSort)
    : "marks";

  const [view, cycles, roster] = await Promise.all([
    loadCandidatePool(),
    loadCycleSummaries(),
    // Read as the caller. `pool_directory` is gated on `private.is_verified()`,
    // so an unverified account gets nothing without this page checking.
    loadRoster({
      search: params.q,
      program: params.program,
      status: Number.isFinite(status) ? status : undefined,
      sort,
      page: Number(params.page) || 1,
    }),
  ]);

  const cycle = cycles.find((c) => c.induction === CURRENT_INDUCTION);

  if (!view.ok) {
    return (
      <div>
        <PortalQuoteStrip />
        <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
          <Eyebrow>Induction Portal</Eyebrow>
          <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em]">
            Candidate Pool
          </h1>
          <Bezel className="mt-8" innerClassName="flex items-start gap-3 p-5">
            <AlertIcon className="mt-0.5 h-4 w-auto shrink-0 text-status-reach" />
            <p className="text-sm leading-relaxed text-fg-muted">
              <span className="font-bold text-status-reach">
                Verify your identity first.
              </span>{" "}
              The pool is only readable once your account is linked to a
              candidate record.{" "}
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

  const { stats } = view;

  const competing = stats.verification.accepted;
  const flagged = stats.noPreferences + stats.lowMarks;

  return (
    <div>
      <PortalQuoteStrip />

      <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <Eyebrow>Induction Portal</Eyebrow>

          <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl text-balance">
            Everyone{" "}
            <span className="text-accent">in the running</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            Every applicant in the cycle, not just those who reached a merit
            list.
          </p>
        </Reveal>

        <Bezel
          className="mt-12"
          innerClassName="grid grid-cols-2 overflow-clip sm:grid-cols-4"
        >
          <Meta label="Applicants" value={stats.total.toLocaleString("en-GB")} />
          <Meta
            label="Cleared"
            value={competing.toLocaleString("en-GB")}
            hint="compete"
            tone="text-status-safe"
          />
          <Meta
            label="Preferences"
            value={stats.preferenceDepth.total.toLocaleString("en-GB")}
            hint="filed"
          />
          <Meta
            label="Cycle"
            value={cycle?.labelWithInduction ?? `Ind ${CURRENT_INDUCTION}`}
          />
        </Bezel>

        {/* ── The roster ────────────────────────────────────────────────── */}
        {/* The original's table, one row per applicant, click through to the
            record. Search, programme, status, sort and page are all applied in
            the database — a client-side filter would need the whole pool in the
            payload, and no request here returns the whole pool. */}
        <section className="mt-12">
          <h2 className="font-sans text-lg font-bold text-foreground">
            All applicants
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">
            Click a row for marks, preferences and certificates.
          </p>

          <RosterTable
            view={roster}
            programs={stats.byProgram.map((p) => p.program)}
            selected={{
              search: params.q ?? "",
              program: params.program ?? "",
              status: params.status ?? "",
              sort,
            }}
          />
        </section>

        {/* ── Programmes ────────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="font-sans text-lg font-bold text-foreground">
            Who applied where
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">
            Counted per applicant, not per preference.
          </p>

          <Bezel className="mt-5" innerClassName="p-6">
            <SeatsByProgram
              noun="applicants"
              data={stats.byProgram.map((p) => ({
                program: p.program,
                seats: p.applicants,
              }))}
            />

            <p className="mt-6 border-t border-border pt-4 font-mono text-[11px] text-fg-muted">
              <span className="font-bold text-foreground">
                {stats.multiProgram.toLocaleString("en-GB")}
              </span>{" "}
              applied in two or more programmes.
            </p>
          </Bezel>
        </section>

        {/* ── Verification ──────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="font-sans text-lg font-bold text-foreground">
            Profile verification
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">
            The portal’s own status. Only Accepted competes in any
            simulation here.
          </p>

          <Bezel
            className="mt-5"
            innerClassName="grid grid-cols-2 overflow-clip sm:grid-cols-4"
          >
            <Meta
              label="Accepted"
              value={stats.verification.accepted.toLocaleString("en-GB")}
              hint="status 1"
              tone="text-status-safe"
            />
            <Meta
              label="Pending"
              value={stats.verification.pending.toLocaleString("en-GB")}
              hint="status 11"
              tone="text-status-reach"
            />
            <Meta
              label="Rejected"
              value={stats.verification.rejected.toLocaleString("en-GB")}
              hint="status 2"
              tone="text-status-danger"
            />
            <Meta
              label="No record"
              value={stats.verification.noRecord.toLocaleString("en-GB")}
              hint="not filed"
            />
          </Bezel>
        </section>

        {/* ── Marks ─────────────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="font-sans text-lg font-bold text-foreground">
            Where the marks sit
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">
            Aggregate marks across the whole pool, in bands of two.
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">
            These are <strong className="text-foreground">base aggregates</strong>,
            before any certificate bonus. A merit list shows the effective
            mark for its seat, so those numbers run higher.
          </p>

          <Bezel className="mt-5" innerClassName="p-6">
            <div className="mb-5 flex flex-wrap gap-x-6 gap-y-2 border-b border-border pb-4 font-mono text-[11px] text-fg-muted">
              <span>
                Median{" "}
                <span className="font-bold text-foreground">
                  {stats.marks.median.toFixed(2)}
                </span>
              </span>
              <span>
                Mean{" "}
                <span className="font-bold text-foreground">
                  {stats.marks.mean.toFixed(2)}
                </span>
              </span>
              <span>
                Highest{" "}
                <span className="font-bold text-accent">
                  {stats.marks.highest.toFixed(2)}
                </span>
              </span>
              <span>
                Lowest{" "}
                <span className="font-bold text-foreground">
                  {stats.marks.lowest.toFixed(2)}
                </span>
              </span>
            </div>

            <PoolBands bands={stats.marks.bands} total={stats.total} />
          </Bezel>
        </section>

        {/* ── Preference depth ──────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="font-sans text-lg font-bold text-foreground">
            How many seats people listed
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">
            The longest list this cycle runs to{" "}
            <span className="font-mono font-bold text-foreground">
              {stats.preferenceDepth.longest}
            </span>
            , and the average is{" "}
            <span className="font-mono font-bold text-foreground">
              {stats.preferenceDepth.mean.toFixed(1)}
            </span>
            .
          </p>

          <Bezel className="mt-5" innerClassName="p-6">
            <PoolBands bands={stats.preferenceDepth.bands} total={stats.total} />
          </Bezel>
        </section>

        {/* ── Data quality, the original's two warnings ─────────────────── */}
        <section className="mt-12">
          <h2 className="font-sans text-lg font-bold text-foreground">
            Records worth a second look
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">
            Almost always an unfinished profile rather than a real
            submission.
          </p>

          <Bezel
            className="mt-5"
            innerClassName="grid grid-cols-1 overflow-clip sm:grid-cols-2"
          >
            <Flag
              label="Applied to no programme"
              value={stats.noPreferences}
              note="cannot be placed anywhere, in any round"
            />
            <Flag
              label="Aggregate below 5"
              value={stats.lowMarks}
              note="data likely needs re-updating, not a weak score"
            />
          </Bezel>

          {flagged === 0 && (
            <p className="mt-3 font-mono text-[11px] text-status-safe">
              Nothing flagged in this cycle.
            </p>
          )}

          {/* Stated rather than quietly matched. The live portal prints 100
              here because its counter only looks at FCPS, MS and MD — the 13
              people who applied to MDS and nothing else come out as having
              applied to nothing. Reproducing that would mislabel 13 real
              candidates, so the figure differs and says why. */}
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-fg-subtle">
            The official portal shows{" "}
            <span className="font-mono font-bold text-foreground">100</span> in
            here because it counts FCPS, MS and MD only. This counts every
            programme.
          </p>
        </section>

        {/* ── What this page does and does not carry ────────────────────── */}
        <section className="mt-12">
          <Bezel innerClassName="p-6">
            <div className="flex items-center gap-2.5">
              <ArchiveIcon className="h-4 w-auto shrink-0 text-accent" />
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                What this page carries
              </p>
            </div>

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-fg-muted">
              Verified accounts only. <strong className="text-foreground">CNIC,
              email, phone and father’s name are not here</strong> — only the
              candidate and staff can see those.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Pill tone="safe">Published</Pill>
              <span className="font-mono text-[11px] text-fg-muted">
                placements and rounds are on the{" "}
                <Link
                  href="/app/portal/merit-list"
                  className="font-bold text-accent underline"
                >
                  Merit List
                </Link>
              </span>
            </div>
          </Bezel>
        </section>

        <p className="mt-16 flex items-start gap-2.5 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          <AlertIcon className="mt-px h-4 w-auto shrink-0 text-status-reach" />
          <span>
            From the portal export when it was captured. Verification status
            moves during a cycle.
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
          <span className="ml-1.5 text-[10px] font-normal text-fg-subtle">
            {hint}
          </span>
        )}
      </p>
    </div>
  );
}

function Flag({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: string;
}) {
  return (
    <div className="-ml-px -mt-px border-l border-t border-border bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-sans text-sm font-bold text-foreground">{label}</p>
        <p
          className={`font-mono text-lg font-bold tabular-nums ${
            value === 0 ? "text-status-safe" : "text-status-reach"
          }`}
        >
          {value.toLocaleString("en-GB")}
        </p>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-fg-subtle">{note}</p>
    </div>
  );
}
