import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { loadSeats } from "@/lib/portal/data";
import { loadPoolSize } from "@/lib/portal/overview";
import { CURRENT_INDUCTION } from "@/lib/induction";
import { loadCycleSummaries } from "@/lib/merit/data";
import { PortalQuoteStrip } from "@/components/portal/quote-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { HairlineCard, HairlineGrid } from "@/components/app/hairline-grid";
import { SeatsByProgram } from "@/components/portal/seats-by-program";
import { Pill, Term, type TermTone } from "@/components/portal/portal-terms";
import { AlertIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Overview | Induction Portal | MeritNama",
  description:
    "What the Induction Portal shows, how to read it, and how the consent overlay and cascade simulation work.",
};

/**
 * The Induction Portal's Overview — its landing tab.
 *
 * Ported from the DEPLOYED portal, which is not what `simulation.html` in this
 * repo contains. That file is older: it opens on a "Guide" tab and lists
 * "Where Merit Falls" and "Seat Allocation" in its nav. The live portal opens
 * on Overview and is organised around the published Merit List with a consent
 * overlay. This is the second time the local copy has been out of date in a way
 * that would have shipped the wrong thing — the first was reading cycle keys as
 * years.
 *
 * Wording, section order and the quick-start steps follow the live page.
 * Presentation is ours.
 */

/** The five steps the live Overview lists, verbatim in intent. */
const QUICK_START = [
  { action: "Open the", target: "Merit List", rest: "tab to see published placements." },
  {
    action: "Use",
    target: "Filters",
    rest: "— round, programme, specialty, hospital, quota — to narrow down.",
  },
  {
    action: "Click",
    target: "Next in line",
    rest: "on any slot to see eligible candidates.",
  },
  {
    action: "Toggle",
    target: "Consent pills",
    rest: "to model accept and reject decisions.",
  },
  {
    action: "Click",
    target: "Simulate next round",
    rest: "to run the cascade engine.",
  },
];

/**
 * The six "how to read it" cards.
 *
 * Bodies are JSX rather than strings so the vocabulary can be highlighted in
 * place, the way the live page does it. The colours are the ones the reader
 * will meet on a slot card, so the paragraph teaches the legend as it goes.
 */
const HOW_TO_READ: Array<{ title: string; body: ReactNode }> = [
  {
    title: "Browsing the merit list",
    body: (
      <>
        Each slot card shows its occupants with consent pills:{" "}
        <Term tone="safe">Accepted</Term> (consented),{" "}
        <Term tone="danger">Excluded</Term> (rejected or dropped),{" "}
        <Term tone="reach">Awaited</Term> (pending). Click a pill to cycle
        states. Use the <Term>Round</Term> dropdown to switch between published
        rounds.
      </>
    ),
  },
  {
    title: "Next in line",
    body: (
      <>
        Every slot has a <Term>Next in line</Term> view. It ranks all eligible
        candidates by marks with <Term>Q#</Term> queue badges, and tags each one
        as a <Term tone="safe">Fresh placement</Term>, an{" "}
        <Term tone="reach">Upgrade chance</Term>,{" "}
        <Term>At higher pref</Term> (will not move), or{" "}
        <Term tone="danger">Locked to other programme</Term>.
      </>
    ),
  },
  {
    title: "Cascade simulation",
    body: (
      <>
        Toggle consent pills to model decisions, then run{" "}
        <Term>Simulate next round</Term>. The engine fills vacated seats and
        upgrades candidates to better preferences. Rejected candidates{" "}
        <Term>carry forward</Term> across rounds, so rounds can be chained —
        simulate round 3 from round 2 output, then round 4, and so on.
      </>
    ),
  },
  {
    title: "Multi-track candidates",
    body: (
      <>
        Someone holding seats under both the{" "}
        <Term tone="reach">Armed Force</Term> and a{" "}
        <Term tone="accent">civilian</Term> quota is in both competitions. Once
        they consent to one, they are <Term>restricted to that quota</Term> —
        which is why a candidate can vanish from a slot they were leading.
      </>
    ),
  },
  {
    title: "Change log",
    body: (
      <>
        After a simulation, a <Term>change log</Term> lists what moved:{" "}
        <Term tone="safe">new placements</Term>,{" "}
        <Term tone="reach">upgrades</Term>, and{" "}
        <Term tone="danger">removals</Term>. Each category expands to the
        specific candidates and their seat changes.
      </>
    ),
  },
  {
    title: "Tags on candidates",
    body: (
      <span className="flex flex-col gap-2">
        <span className="flex items-baseline gap-1.5">
          <Pill tone="reach">Armed</Pill>
          <Pill tone="accent">Civilian</Pill>
          <span>— the quota track.</span>
        </span>
        <span className="flex items-baseline gap-1.5">
          <Pill tone="danger">Multi-track</Pill>
          <span>— in both Armed and civilian.</span>
        </span>
        <span className="flex items-baseline gap-1.5">
          <Pill tone="reach">Multi-programme</Pill>
          <span>— placed in more than one programme.</span>
        </span>
        <span className="flex items-baseline gap-1.5">
          <Pill tone="danger">Profile rejected</Pill>
          <span>— failed verification, so cannot hold a seat.</span>
        </span>
      </span>
    ),
  },
];

const KEY_CONCEPTS: Array<{ term: string; meaning: ReactNode }> = [
  {
    term: "Published merit",
    meaning: "Official placements from the portal. Each round is a snapshot.",
  },
  {
    term: "Consent overlay",
    meaning: (
      <>
        <Term tone="safe">Accepted</Term> keeps the seat.{" "}
        <Term tone="danger">Excluded</Term> vacates it.{" "}
        <Term tone="reach">Awaited</Term> is a decision not yet made.
      </>
    ),
  },
  {
    term: "Cascade engine",
    meaning:
      "Fills vacated seats in merit order and upgrades candidates to better preferences.",
  },
  {
    term: "Carry-forward",
    meaning: "Candidates rejected in one round stay ineligible in every later one.",
  },
];

/**
 * Tones carry the outcome, not the wording.
 *
 * Each of these four resolutions either keeps a seat or takes it away, and the
 * colour says which before the sentence is read.
 */
const CONSENT_RESOLUTION: Array<{ term: string; meaning: string; tone: TermTone }> = [
  {
    term: "Exact match",
    meaning: "the consent status recorded for this specific slot.",
    tone: "plain",
  },
  {
    term: "Accepted elsewhere",
    meaning: "the candidate consented to a different slot, so this seat is vacated.",
    tone: "danger",
  },
  {
    term: "Rejected in same track",
    meaning: "rejected for this programme and quota, so the seat is vacated.",
    tone: "danger",
  },
  {
    term: "No match",
    meaning: "no decision recorded — awaiting one.",
    tone: "reach",
  },
];

const QUEUE_TAGS: Array<{ term: string; meaning: string; tone: TermTone }> = [
  {
    term: "Q1, Q2, Q3…",
    meaning: "queue position. Q1 has the highest marks and takes the seat first.",
    tone: "plain",
  },
  {
    term: "Fresh placement",
    meaning: "not currently placed anywhere, so can take this slot directly.",
    tone: "safe",
  },
  {
    term: "Upgrade chance",
    meaning: "currently at a worse preference, so can move here and vacate the old seat.",
    tone: "reach",
  },
  {
    term: "At higher pref",
    meaning: "already at a better preference. Will not move, and is shown dimmed.",
    tone: "plain",
  },
  {
    term: "Locked to other programme",
    meaning: "a multi-track candidate who consented elsewhere. Cannot take this slot.",
    tone: "danger",
  },
];

const GLOSSARY = [
  {
    term: "Consent round",
    meaning:
      "The portal publishes a merit list, then candidates accept or reject their assigned seat. Rejections create the vacancies the next round fills.",
  },
  {
    term: "Effective mark",
    meaning:
      "Aggregate marks plus the certificate bonus for that specific programme and specialty. This is what decides queue order — not the aggregate alone.",
  },
  {
    term: "Multi-track",
    meaning:
      "Holds seats under both the Armed Force and a civilian quota in the same programme. Restricted to the consented quota once a decision is made.",
  },
  {
    term: "Multi-programme",
    meaning:
      "Placed in more than one programme, for example FCPS and MD. Consenting to one restricts them to it.",
  },
  {
    term: "Locked (P#1)",
    meaning:
      "Accepted at their own first preference. Nothing within the programme can improve on that, so they only stay put across programmes.",
  },
  {
    term: "Profile status",
    meaning:
      "Verification and amendment outcome. Only Accepted candidates are eligible; Pending, Rejected and no-record are all excluded.",
  },
];

export default async function PortalOverviewPage() {
  const [seats, cycles, poolSize] = await Promise.all([
    loadSeats(),
    loadCycleSummaries(),
    loadPoolSize(),
  ]);

  const totalSeats = seats.reduce((sum, s) => sum + s.seats, 0);

  const byProgram = new Map<string, number>();
  for (const seat of seats) {
    byProgram.set(seat.program, (byProgram.get(seat.program) ?? 0) + seat.seats);
  }
  const programSeats = [...byProgram.entries()]
    .map(([program, count]) => ({ program, seats: count }))
    .sort((a, b) => b.seats - a.seats);

  const cycle = cycles.find((c) => c.induction === CURRENT_INDUCTION);

  return (
    <div>
      <PortalQuoteStrip />

      <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
          {/* No enclosure on a page's own opening — see `/app`. */}
          <Reveal>
            <div className="lg:pt-1">
              <Eyebrow>What this shows</Eyebrow>

              <h1 className="mt-6 max-w-[20ch] font-sans text-[2rem] font-black leading-[1.05] tracking-[-0.02em] text-balance sm:text-4xl lg:text-5xl">
                The published merit list, with consent and simulation.
              </h1>

              <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
                The official merit list for each round, with consent data
                over it — who accepted, who rejected, and who has not
                answered.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/app/portal/merit-list"
                  className="flex min-h-[48px] items-center rounded-sm bg-accent-strong px-6 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98]"
                >
                  Open merit list
                </Link>

                <Link
                  href="/app/portal/allocation"
                  className="flex min-h-[48px] items-center rounded-sm border border-border-strong px-5 text-sm font-bold text-foreground transition-colors hover:border-accent"
                >
                  Run seat allocation
                </Link>
              </div>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <Bezel innerClassName="p-6">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                Quick start
              </p>

              <ol className="mt-5 flex flex-col gap-4">
                {QUICK_START.map((step, i) => (
                  <li
                    key={step.target}
                    className="flex gap-3 text-sm leading-relaxed text-fg-muted"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-quiet font-mono text-[10px] font-bold text-accent">
                      {i + 1}
                    </span>
                    <span>
                      {step.action}{" "}
                      <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-foreground">
                        {step.target}
                      </span>{" "}
                      {step.rest}
                    </span>
                  </li>
                ))}
              </ol>
            </Bezel>
          </Reveal>
        </div>

        {/* Counts read from the database rather than written into the copy.
            The live page states these too, and a hardcoded figure is the thing
            that goes stale first. */}
        <Bezel
          className="mt-6"
          innerClassName="grid grid-cols-2 overflow-clip sm:grid-cols-4"
        >
          <Meta
            label="Candidates in pool"
            value={poolSize.toLocaleString("en-GB")}
          />
          <Meta label="Total training seats" value={totalSeats.toLocaleString("en-GB")} />
          <Meta label="Programmes" value={String(programSeats.length)} />
          <Meta
            label="Cycle"
            value={cycle?.labelWithInduction ?? `Ind ${CURRENT_INDUCTION}`}
          />
        </Bezel>

        <section className="mt-16">
          <h2 className="font-sans text-2xl font-black tracking-tight sm:text-3xl">
            Seats by programme
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-muted">
            Where the {totalSeats.toLocaleString("en-GB")} training seats in this
            cycle actually sit.
          </p>

          <Bezel className="mt-6" innerClassName="p-6">
            <SeatsByProgram data={programSeats} />
          </Bezel>
        </section>

        <section className="mt-16">
          <h2 className="font-sans text-2xl font-black tracking-tight sm:text-3xl">
            How to read it
          </h2>

          <HairlineGrid className="mt-6 md:grid-cols-2 xl:grid-cols-3">
            {HOW_TO_READ.map(({ title, body }) => (
              <HairlineCard key={title} className="h-full p-5">
                <h3 className="font-sans text-sm font-bold text-foreground">{title}</h3>
                {/* A div, not a <p>: these bodies carry pills and stacked rows,
                    and block content inside a paragraph is invalid HTML that
                    throws a hydration error. */}
                <div className="mt-3 text-xs leading-relaxed text-fg-muted">{body}</div>
              </HairlineCard>
            ))}
          </HairlineGrid>
        </section>

        <section className="mt-16">
          <h2 className="font-sans text-2xl font-black tracking-tight sm:text-3xl">
            Key concepts
          </h2>

          <HairlineGrid className="mt-6 md:grid-cols-2 xl:grid-cols-4">
            {KEY_CONCEPTS.map(({ term, meaning }) => (
              <HairlineCard key={term} className="h-full p-5">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                  {term}
                </p>
                <p className="mt-3 text-xs leading-relaxed text-fg-muted">{meaning}</p>
              </HairlineCard>
            ))}
          </HairlineGrid>
        </section>



        <section className="mt-16">
          <h2 className="font-sans text-2xl font-black tracking-tight sm:text-3xl">
            Glossary
          </h2>

          <Bezel className="mt-6" innerClassName="p-6">
            <dl className="grid gap-x-8 gap-y-5 md:grid-cols-2">
              {GLOSSARY.map(({ term, meaning }) => (
                <div key={term}>
                  <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                    {term}
                  </dt>
                  <dd className="mt-1.5 text-xs leading-relaxed text-fg-muted">
                    {meaning}
                  </dd>
                </div>
              ))}
            </dl>
          </Bezel>
        </section>

        <p className="mt-16 flex items-start gap-2.5 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          <AlertIcon className="mt-px h-4 w-auto shrink-0 text-status-reach" />
          <span>
            <span className="font-bold text-status-reach">Planning aid only.</span>{" "}
            This portal cannot see eligibility rulings, grievance outcomes or
            manual corrections, and the official allocation applies all three.
            Verify seat counts, schedules and merit lists with PHF / PMDC / PGMI
            before acting on anything here.
          </span>
        </p>
      </div>
    </div>
  );
}

function DefinitionList({
  items,
}: {
  items: Array<{ term: string; meaning: string; tone: TermTone }>;
}) {
  return (
    <dl className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
      {items.map(({ term, meaning, tone }) => (
        <div key={term} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
          <dt className="w-44 shrink-0">
            <Term tone={tone}>
              <span className="font-mono text-[10px] uppercase tracking-wider">
                {term}
              </span>
            </Term>
          </dt>
          <dd className="text-xs leading-relaxed text-fg-muted">{meaning}</dd>
        </div>
      ))}
    </dl>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="-ml-px -mt-px border-l border-t border-border bg-surface p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-bold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
