import type { Metadata } from "next";
import Link from "next/link";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { loadCycleSummaries, loadMeritRows } from "@/lib/merit/data";
import { CURRENT_INDUCTION } from "@/lib/induction";
import { VerseStrip } from "@/components/app/verse-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import {
  AlertIcon,
  ArchiveIcon,
  BalanceIcon,
  ChartIcon,
  CompassIcon,
  TableIcon,
  TargetIcon,
} from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Candidate Portal | MeritNama",
  description:
    "Your candidate record, and everything MeritNama can tell you about this induction.",
};

/**
 * Candidate portal home — the first screen after signing in.
 *
 * Every query runs as the signed-in user, so Row Level Security decides what
 * comes back. Nothing here filters by user id in application code: if the
 * policies were wrong this page would show the wrong data, which is exactly why
 * the policies have their own test suite rather than being trusted.
 *
 * What it shows depends on whether the account is linked to a candidate record.
 * An unlinked account is the normal state for most visitors — the aggregates
 * are the product, the personal record is an extra — so the unlinked view is a
 * complete page rather than an error.
 */
export default async function AppHome() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  // Tier 2. Returns the caller's own record, or nothing — the policy resolves
  // it through `candidate_links`, so no applicant id is passed from the client.
  const { data: candidate } = await supabase
    .from("candidates")
    .select(
      "applicant_id, induction, name_full, pmdc_no, marks_total, preferences, consent_rounds"
    )
    .maybeSingle();

  // Cycle summaries rather than `loadCycles`: that list is derived from the
  // cycles that HAVE closing merits, so the cycle now open — which by
  // definition has none — would be missing, and the calculator card would name
  // the previous cycle's formula as the active one.
  const [rows, cycles] = await Promise.all([
    loadMeritRows(),
    loadCycleSummaries(),
  ]);

  // Two different facts that were, until recently, both called "preferences".
  // `preferences` is the ordered list of every seat the candidate applied for.
  // `consent_rounds` is one entry per round they consented in, carrying the
  // seat they were offered and whether they took it. Showing the second under
  // the first's label reported a candidate with eight consent rounds as having
  // submitted eight preferences.
  const preferences = Array.isArray(candidate?.preferences)
    ? (candidate.preferences as Array<Record<string, unknown>>)
    : [];
  const consentRounds = Array.isArray(candidate?.consent_rounds)
    ? (candidate.consent_rounds as Array<Record<string, unknown>>)
    : [];

  // Year and induction together: the applicant id belongs to one cycle and to
  // no other, and "21" alone does not tell anyone when that was.
  const cycleLabel =
    cycles.find((c) => c.induction === (candidate?.induction ?? CURRENT_INDUCTION))
      ?.labelWithInduction ?? `Ind ${candidate?.induction ?? CURRENT_INDUCTION}`;

  const activeCycleLabel =
    cycles.find((c) => c.induction === CURRENT_INDUCTION)?.labelWithInduction ??
    `Ind ${CURRENT_INDUCTION}`;

  const firstName = candidate?.name_full?.trim().split(/\s+/)[0];

  return (
    <div>
      <VerseStrip />

      <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
          <Reveal>
            <Bezel innerClassName="p-6 sm:p-8">
              <Eyebrow>Candidate Portal</Eyebrow>

              <h1 className="mt-6 max-w-[18ch] font-sans text-[2rem] font-black leading-[1.05] tracking-[-0.02em] sm:text-4xl lg:text-5xl">
                {firstName ? `Welcome back, ${firstName}.` : "Welcome to MeritNama."}
              </h1>

              <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
                {candidate
                  ? `Your ${cycleLabel} record is linked to this account. Everything below reads from it, and from ${rows.length.toLocaleString("en-GB")} seat combinations of closing-merit history.`
                  : `Start with the calculator to work out your merit, then run it against ${rows.length.toLocaleString("en-GB")} seat combinations of closing-merit history to see where it lands.`}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/app/calculator"
                  className="flex min-h-[48px] items-center rounded-sm bg-accent-strong px-6 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98]"
                >
                  Calculate my merit
                </Link>

                <Link
                  href="/app/start"
                  className="flex min-h-[48px] items-center rounded-sm border border-border-strong px-5 text-sm font-bold text-foreground transition-colors hover:border-accent"
                >
                  New here? Start here
                </Link>
              </div>
            </Bezel>
          </Reveal>

          <Reveal delay={120}>
            {candidate ? (
              <Bezel innerClassName="p-6">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                  Your record
                </p>

                <dl className="mt-5 flex flex-col gap-4">
                  {/* An applicant id means nothing without its cycle — the same
                      number belongs to a different person in another induction. */}
                  <Row label="Applicant ID" value={String(candidate.applicant_id)} sub={cycleLabel} />
                  <Row label="PMDC" value={candidate.pmdc_no ?? "—"} />
                  <Row
                    label="Aggregate marks"
                    value={
                      candidate.marks_total != null
                        ? Number(candidate.marks_total).toFixed(2)
                        : "—"
                    }
                  />
                  <Row
                    label="Preferences submitted"
                    value={preferences.length ? String(preferences.length) : "—"}
                  />
                  <Row
                    label="Consent rounds"
                    value={consentRounds.length ? String(consentRounds.length) : "—"}
                  />
                </dl>
              </Bezel>
            ) : (
              <Bezel innerClassName="p-6">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                  No candidate record linked
                </p>

                <p className="mt-5 text-sm leading-relaxed text-fg-muted">
                  This account is not linked to an Induction {CURRENT_INDUCTION}{" "}
                  candidate record, so there are no personal figures to show.
                  Everything else on MeritNama works without one.
                </p>

                {/* Deliberately not an "enter your applicant id" form. The
                    applicant id and email were both published in the original
                    site's leak, so neither proves anything — a link is only
                    created after a credential reaches the address already on
                    the candidate record. */}
                <p className="mt-4 text-xs leading-relaxed text-fg-subtle">
                  Linking is verified by sending a single-use link to the
                  contact address already held on the official record, so it
                  cannot be requested with an applicant id alone.
                </p>
              </Bezel>
            )}
          </Reveal>
        </div>

        <section className="mt-16">
          <h2 className="font-sans text-2xl font-black tracking-tight sm:text-3xl">
            Where to go next
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[
              {
                label: "Merit Table",
                href: "/app/merit",
                Icon: TableIcon,
                figure: rows.length.toLocaleString("en-GB"),
                figureLabel: "seat combinations",
                description:
                  "Closing merits by specialty, hospital, programme and quota across every cycle on record.",
              },
              {
                label: "My Prediction",
                href: "/app/prediction",
                Icon: TargetIcon,
                figure: "Safe · Target · Reach",
                figureLabel: "for your score",
                description:
                  "Run your merit against the history and see which seats are realistic, with a confidence read on each.",
              },
              {
                label: "Calculator",
                href: "/app/calculator",
                Icon: ChartIcon,
                figure: activeCycleLabel,
                figureLabel: "active policy",
                description:
                  "Work out your aggregate from marks, experience, publications and the rest of the current formula.",
              },
              {
                label: "Compare",
                href: "/app/compare",
                Icon: BalanceIcon,
                figure: "2–3",
                figureLabel: "seats side by side",
                description:
                  "Put the combinations you are weighing up next to each other, metric by metric.",
              },
              {
                label: "Previous Merit Lists",
                href: "/app/merit-lists",
                Icon: ArchiveIcon,
                figure: "Round by round",
                figureLabel: "as published",
                description:
                  "Candidate-level merit lists from completed cycles, in the order PHF published them.",
              },
              {
                label: "Start Here",
                href: "/app/start",
                Icon: CompassIcon,
                figure: "4 steps",
                figureLabel: "first session",
                description:
                  "Orientation: what each area is for, and the order to work through them in.",
              },
            ].map(({ label, href, Icon, figure, figureLabel, description }) => (
              <Link key={label} href={href} className="group">
                <Bezel innerClassName="flex h-full flex-col p-5 transition-colors group-hover:bg-surface-sunken/40">
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-5 w-auto text-accent" />
                    <span className="font-sans text-sm font-bold text-foreground">
                      {label}
                    </span>
                  </div>

                  <p className="mt-4 font-mono text-xl font-black text-accent">
                    {figure}
                  </p>
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
                    {figureLabel}
                  </p>

                  <p className="mt-3 flex-1 text-xs leading-relaxed text-fg-muted">
                    {description}
                  </p>
                </Bezel>
              </Link>
            ))}
          </div>
        </section>

        <p className="mt-16 flex items-start gap-2.5 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          <AlertIcon className="mt-px h-4 w-auto shrink-0 text-status-reach" />
          <span>
            Signed in as{" "}
            <span className="font-mono text-fg-muted">{user?.email}</span>.
            MeritNama is an independent community tool — verify eligibility,
            schedules, seat counts and official merit lists with PHF / PMDC /
            PGMI before relying on anything here.
          </span>
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-muted">
        {label}
      </dt>
      <dd className="text-right">
        <span className="font-mono text-sm font-bold tabular-nums text-foreground">
          {value}
        </span>
        {sub && (
          <span className="mt-0.5 block font-mono text-[10px] text-fg-subtle">
            {sub}
          </span>
        )}
      </dd>
    </div>
  );
}
