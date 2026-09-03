import type { Metadata } from "next";
import Link from "next/link";
import { activeScope, inScope, STATUS_SCOPES } from "@/lib/portal/config";
import { loadCandidatePool } from "@/lib/portal/pool";
import { loadSeats } from "@/lib/portal/data";
import { CURRENT_INDUCTION } from "@/lib/induction";
import { loadCycleSummaries } from "@/lib/merit/data";
import { ScopeSelector } from "@/components/portal/scope-selector";
import { PortalQuoteStrip } from "@/components/portal/quote-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { Pill } from "@/components/portal/portal-terms";
import { AlertIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Config | Induction Portal | MeritNama",
  description:
    "The settings every simulation in the portal runs under, and which of them can be changed.",
};

/**
 * Simulation Config.
 *
 * The original's framing: an Active Configuration card with three dropdowns,
 * then an overview strip restating what is in force and how much data is
 * loaded.
 *
 * Only one of the three is honoured here, and the page says which and why. A
 * dropdown that changes nothing is worse than a stated constraint — the reader
 * would set it, believe the numbers beneath it had moved, and act on that.
 */
export default async function PortalConfigPage() {
  const [scope, pool, seats, cycles] = await Promise.all([
    activeScope(),
    loadCandidatePool(),
    loadSeats(),
    loadCycleSummaries(),
  ]);

  const cycle = cycles.find((c) => c.induction === CURRENT_INDUCTION);

  if (!pool.ok) {
    return (
      <div>
        <PortalQuoteStrip />
        <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
          <Eyebrow>Induction Portal</Eyebrow>
          <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em]">
            Simulation Config
          </h1>
          <Bezel className="mt-8" innerClassName="flex items-start gap-3 p-5">
            <AlertIcon className="mt-0.5 h-4 w-auto shrink-0 text-status-reach" />
            <p className="text-sm leading-relaxed text-fg-muted">
              <span className="font-bold text-status-reach">
                Verify your identity first.
              </span>{" "}
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

  const { verification, total } = { ...pool.stats, total: pool.stats.total };

  // How many the active scope admits, from the same counts the Candidate Pool
  // reports — so the two pages cannot disagree about who is competing.
  const matching =
    (inScope(scope, 1) ? verification.accepted : 0) +
    (inScope(scope, 11) ? verification.pending : 0) +
    (inScope(scope, 2) ? verification.rejected : 0) +
    (scope.statusIds.length === 0 ? verification.noRecord : 0);

  const seatTotal = seats.reduce((sum, s) => sum + s.seats, 0);

  return (
    <div>
      <PortalQuoteStrip />

      <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <Eyebrow>Induction Portal</Eyebrow>

          <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl text-balance">
            What every{" "}
            <span className="text-accent">run assumes</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            The settings every simulation in this portal runs under.
          </p>
        </Reveal>

        {/* ── Active configuration ──────────────────────────────────────── */}
        <Bezel className="mt-12" innerClassName="p-6">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
            Active configuration
          </p>

          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <Fixed
              label="Merit formula"
              value="Official"
              note="Base: marks total, as the gazette publishes it."
            />

            <Fixed
              label="Candidate revision"
              value="None"
              note="Amendments are shown on a record, not applied to a run."
            />

            <ScopeSelector scopes={STATUS_SCOPES} active={scope.id} />
          </div>

          <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-fg-muted">
            <span className="font-bold text-foreground">
              {matching.toLocaleString("en-GB")}
            </span>{" "}
            of {total.toLocaleString("en-GB")} candidates match the active scope.{" "}
            {scope.description}
          </p>
        </Bezel>

        {/* ── Overview strip ────────────────────────────────────────────── */}
        <Bezel
          className="mt-6"
          innerClassName="grid grid-cols-2 overflow-clip sm:grid-cols-3 lg:grid-cols-5"
        >
          <Card label="Merit formula" value="Official" note="Base: marks total" />
          <Card
            label="Candidate revision"
            value="None"
            note="1 amendment in the data"
          />
          <Card
            label="Status scope"
            value={scope.label}
            note={`${matching.toLocaleString("en-GB")} match`}
            tone="text-accent"
          />
          <Card
            label="Candidates"
            value={total.toLocaleString("en-GB")}
            note={`${seatTotal.toLocaleString("en-GB")} seats loaded`}
          />
          <Card
            label="Cycle"
            value={cycle?.labelWithInduction ?? `Ind ${CURRENT_INDUCTION}`}
            note={`${verification.accepted.toLocaleString("en-GB")} verified`}
          />
        </Bezel>

        {/* ── What each scope means ─────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="font-sans text-lg font-bold text-foreground">
            What each scope means
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">
            The portal’s own verification ids. A candidate with{" "}
            <Pill tone="plain">no record</Pill> is not the same as one marked
            pending, and only the unfiltered scope admits them — a named scope
            lists explicit ids, so nobody slips in by default.
          </p>

          <div className="mt-5 flex flex-col gap-2">
            {STATUS_SCOPES.map((s) => (
              <Bezel key={s.id} innerClassName="flex flex-wrap items-baseline gap-x-4 gap-y-1 p-4">
                <span className="min-w-[10rem] font-sans text-sm font-bold text-foreground">
                  {s.label}
                  {s.id === scope.id && (
                    <span className="ml-2 font-mono text-[9px] uppercase tracking-wider text-accent">
                      active
                    </span>
                  )}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-fg-subtle">
                  {s.statusIds.length ? `status ${s.statusIds.join(", ")}` : "no filter"}
                </span>
                <span className="min-w-0 flex-1 text-xs leading-relaxed text-fg-muted">
                  {s.description}
                </span>
              </Bezel>
            ))}
          </div>
        </section>

        {/* ── The two that are fixed, and why ───────────────────────────── */}
        <section className="mt-12">
          <h2 className="font-sans text-lg font-bold text-foreground">
            Why two of these cannot be changed
          </h2>

          <Bezel className="mt-5" innerClassName="p-6">
            <p className="max-w-3xl text-sm leading-relaxed text-fg-muted">
              <span className="font-bold text-foreground">Merit formula.</span>{" "}
              The official portal offers a second option, “MS/MD Marks
              Adjusted”. A formula there is a definition — which fields to
              sum and which to add or subtract — stored in the site
              owner’s own configuration, and that definition is not
              something this app holds. Offering the option without it would
              produce a number with no basis.
            </p>

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-fg-muted">
              <span className="font-bold text-foreground">
                Candidate revision.
              </span>{" "}
              Selecting an amendment re-derives every candidate’s mark by
              subtracting a per-field delta across house job, position, MDCAT
              and degree. The amendments are held here and are shown on a
              record in the Candidate Pool, but the engines read a precomputed
              total, so applying one means recomputing the whole pool rather
              than flipping a switch. It is left off rather than half-applied.
            </p>

            <p className="mt-4 max-w-3xl text-xs leading-relaxed text-fg-subtle">
              Both are shown rather than hidden, so a missing control does
              not read as a lost feature.
            </p>
          </Bezel>
        </section>

        <p className="mt-16 flex items-start gap-2.5 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          <AlertIcon className="mt-px h-4 w-auto shrink-0 text-status-reach" />
          <span>
            The scope is stored in this browser and affects what you see, not
            what the gazette published. Widening it past{" "}
            <span className="font-bold text-foreground">Accepted only</span>{" "}
            puts unverified candidates into every simulation, which is useful
            for asking “what if verification goes the other way” and
            misleading as a prediction.
          </span>
        </p>
      </div>
    </div>
  );
}

function Fixed({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-fg-muted">
        {label}
      </p>
      {/* Not a disabled <select>. There is one option, so a dropdown would
          promise a choice that does not exist. */}
      <div className="flex min-h-[46px] items-center rounded-sm border border-border bg-surface-sunken px-3 text-sm text-fg-muted">
        {value}
        <span className="ml-2 font-mono text-[9px] uppercase tracking-wider text-fg-subtle">
          fixed
        </span>
      </div>
      <p className="mt-1 font-mono text-[10px] leading-snug text-fg-subtle">
        {note}
      </p>
    </div>
  );
}

function Card({
  label,
  value,
  note,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  note: string;
  tone?: string;
}) {
  return (
    <div className="-ml-px -mt-px border-l border-t border-border bg-surface p-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
        {label}
      </p>
      <p className={`mt-1 font-sans text-base font-bold ${tone}`}>{value}</p>
      <p className="mt-1 font-mono text-[10px] leading-snug text-fg-subtle">
        {note}
      </p>
    </div>
  );
}
