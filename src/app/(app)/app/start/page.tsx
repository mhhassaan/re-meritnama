import type { Metadata } from "next";
import Link from "next/link";
import { loadCycleSummaries } from "@/lib/merit/data";
import { StepLink } from "@/components/app/step-link";
import { VerseStrip } from "@/components/app/verse-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { HairlineCard, HairlineGrid } from "@/components/app/hairline-grid";
import { CycleTrendChart } from "@/components/merit/cycle-trend-chart";
import {
  AlertIcon,
  ArchiveIcon,
  BalanceIcon,
  ChartIcon,
  DoorIcon,
  MessagesIcon,
  SealIcon,
  TableIcon,
  TargetIcon,
} from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Start Here | MeritNama",
  description:
    "Orientation for new users: calculate your merit, compare it against historical closing merits, and understand the induction portal.",
};

/**
 * Start Here — the orientation page.
 *
 * A redesign of the original's, with its structure and wording kept: the
 * intro, the recommended first session, the four numbered steps, the map of
 * what each area is for, and the list of every cycle on record.
 *
 * Destinations that do not exist yet are rendered as disabled, matching how the
 * sidebar handles them. Sending someone new to a 404 is a worse first
 * impression than telling them it is coming.
 */

const STEPS = [
  {
    number: 1,
    title: "Calculate your merit",
    description:
      "Use the active policy calculator to estimate your score from marks, experience, publications, and other components.",
    action: "Go to Calculator",
    href: "/app/calculator",
    Icon: ChartIcon,
  },
  {
    number: 2,
    title: "Get a personal prediction",
    description:
      "Compare your score against historical cutoffs and get Safe, Target, and Reach options with trend confidence.",
    action: "Analyze my score",
    href: "/app/prediction",
    Icon: TargetIcon,
  },
  {
    number: 3,
    title: "Check a target seat",
    description:
      "Pick a program, quota, specialty, and hospital to see what score has historically been required.",
    action: "Find my target score",
    href: "/app/prediction",
    Icon: SealIcon,
  },
  {
    number: 4,
    title: "Learn the induction portal",
    description:
      "Open the portal guide to understand candidate pool, preferences, seat allocation, schedules, hospitals, and chat.",
    action: "Open portal guide",
    href: "/app/portal",
    Icon: DoorIcon,
  },
] as const;

const AREAS = [
  {
    label: "Merit Table",
    description:
      "Browse historical cutoffs by specialty, hospital, program, and quota.",
    href: "/app/merit",
    Icon: TableIcon,
  },
  {
    label: "Previous Merit Lists",
    description:
      "Browse opening and closing merits from completed induction cycles.",
    href: "/app/merit-lists",
    Icon: ArchiveIcon,
  },
  {
    label: "Compare",
    description:
      "Put two or three specialty and hospital combinations side by side.",
    href: "/app/compare",
    Icon: BalanceIcon,
  },
  {
    label: "Accreditation",
    description: "Check training recognition before shortlisting hospitals.",
    href: "/app/accreditation",
    Icon: SealIcon,
  },
  {
    label: "Discussion",
    description:
      "Ask the community about hospitals, preferences, and updates.",
    href: "/app/discussion",
    Icon: MessagesIcon,
  },
] as const;

const FIRST_SESSION = [
  "Calculate or enter your merit score.",
  "Run My Prediction for Safe, Target, and Reach options.",
  "Switch My Prediction to “I have a target” mode for specific specialty goals.",
  "Open the Induction Portal guide before using live simulation tools.",
];

export default async function StartHerePage() {
  const cycles = await loadCycleSummaries();

  return (
    <div>
      <VerseStrip />

      <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
          {/* No enclosure on a page's own opening — see `/app`. */}
          <Reveal>
            <div className="lg:pt-1">
              <Eyebrow>New to MeritNama?</Eyebrow>

              <h1 className="mt-6 max-w-[20ch] font-sans text-[2rem] font-black leading-[1.05] tracking-[-0.02em] text-balance sm:text-4xl lg:text-5xl">
                Start here to understand the portal, your merit, and your
                options.
              </h1>

              <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
                Calculate your score, compare it with past closing merits,
                then move into the Induction Portal.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/app/calculator"
                  className="flex min-h-[48px] items-center rounded-sm bg-accent-strong px-6 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98]"
                >
                  Calculate my merit
                </Link>

                <Link
                  href="/app/guide"
                  className="flex min-h-[48px] items-center rounded-sm border border-border-strong px-5 text-sm font-bold text-foreground transition-colors hover:border-accent"
                >
                  Read the full guide
                </Link>

                <Link
                  href="/app/portal"
                  className="flex min-h-[48px] items-center rounded-sm border border-border-strong px-5 text-sm font-bold text-foreground transition-colors hover:border-accent"
                >
                  Open Induction Portal
                </Link>
              </div>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <Bezel innerClassName="p-6">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                Recommended first session
              </p>

              <ol className="mt-5 flex flex-col gap-4">
                {FIRST_SESSION.map((item, i) => (
                  <li key={item} className="flex gap-3 text-sm leading-relaxed text-fg-muted">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-quiet font-mono text-[10px] font-bold text-accent">
                      {i + 1}
                    </span>
                    {item}
                  </li>
                ))}
              </ol>
            </Bezel>
          </Reveal>
        </div>

        <HairlineGrid className="mt-6 md:grid-cols-2 xl:grid-cols-4">
          {STEPS.map(({ number, title, description, action, href, Icon }) => (
            <HairlineCard key={number} className="flex h-full flex-col p-5">
              <Icon className="h-6 w-auto text-accent" />

              <h2 className="mt-4 font-sans text-sm font-bold text-foreground">
                {number}. {title}
              </h2>

              <p className="mt-2 flex-1 text-xs leading-relaxed text-fg-muted">
                {description}
              </p>

              {href ? (
                <StepLink href={href} label={action} className="mt-4" />
              ) : (
                <span className="mt-4 inline-flex items-center gap-1 font-mono text-[11px] font-bold text-fg-subtle">
                  {action} · soon
                </span>
              )}
            </HairlineCard>
          ))}
        </HairlineGrid>

        <section className="mt-16">
          <h2 className="font-sans text-2xl font-black tracking-tight sm:text-3xl">
            What each main area is for
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-muted">
            Follow this map if you recently joined and are unsure where to
            begin.
          </p>

          <HairlineGrid className="mt-6 md:grid-cols-2 xl:grid-cols-4">
            {AREAS.map(({ label, description, href, Icon }) => {
              const body = (
                <>
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-auto text-accent" />
                    <span className="font-sans text-sm font-bold text-foreground">
                      {label}
                    </span>
                    {!href && (
                      <span className="ml-auto rounded-sm border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-fg-subtle">
                        Soon
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-fg-muted">
                    {description}
                  </p>
                </>
              );

              // Hover is a fill, not a border: a border appearing on hover
              // puts back the box the hairline grid just removed.
              return href ? (
                <Link
                  key={label}
                  href={href}
                  className="group -ml-px -mt-px flex h-full flex-col border-l border-t border-border bg-background p-4 transition-colors hover:bg-surface"
                >
                  {body}
                </Link>
              ) : (
                <HairlineCard key={label} className="h-full p-4">
                  {body}
                </HairlineCard>
              );
            })}
          </HairlineGrid>
        </section>

        <section className="mt-16">
          <h2 className="font-sans text-2xl font-black tracking-tight sm:text-3xl">
            All previous cycles
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-muted">
            Closing merit trends across every cycle — see how the landscape
            changes.
          </p>

          <Bezel className="mt-6" innerClassName="p-5">
            <CycleTrendChart cycles={cycles} />
          </Bezel>

          <HairlineGrid className="mt-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cycles.map((cycle) => (
              // The open cycle is marked by its own "Active" pill rather than by
              // a coloured ring, which a hairline grid has nowhere to put.
              <HairlineCard
                key={cycle.induction}
                className="flex h-full flex-col p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Year AND induction. Two cards read "2026" otherwise, and
                      nothing else on the card distinguishes them at a glance. */}
                  <span
                    className="font-mono text-sm font-bold text-foreground"
                    title={cycle.policyLabel ?? undefined}
                  >
                    {cycle.labelWithInduction}
                  </span>

                  {cycle.isCurrent && (
                    <span className="rounded-sm bg-accent-quiet px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-accent">
                      Active
                    </span>
                  )}
                </div>

                <p className="mt-3 font-mono text-3xl font-black tabular-nums text-accent">
                  {cycle.totalMarks ?? "—"}
                </p>
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
                  Total max marks
                  {cycle.isCurrent && " · current formula"}
                </p>

                <div className="mt-4 flex flex-col gap-1 border-t border-border pt-3 font-mono text-[10px] text-fg-subtle">
                  <span>{cycle.componentsIncluded} components included</span>
                  {cycle.componentsRemoved > 0 && (
                    <span>{cycle.componentsRemoved} components removed</span>
                  )}
                  <span>
                    {cycle.trackedEntries.toLocaleString("en-GB")} tracked
                    entries
                  </span>
                </div>
              </HairlineCard>
            ))}
          </HairlineGrid>
        </section>

        <p className="mt-16 flex items-start gap-2.5 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          <AlertIcon className="mt-px h-4 w-auto shrink-0 text-status-reach" />
          <span>
            <span className="font-bold text-status-reach">Important:</span>{" "}
            MeritNama is an independent community tool. Use it for orientation
            and planning, then verify eligibility, schedule, seat counts, and
            official merit lists directly with PHF / PMDC / PGMI sources.
          </span>
        </p>
      </div>
    </div>
  );
}
