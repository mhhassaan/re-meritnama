import type { Metadata } from "next";
import Link from "next/link";
import { VerseStrip } from "@/components/app/verse-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { Pill } from "@/components/portal/portal-terms";
import { AlertIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Guide | MeritNama",
  description:
    "A reference for every term and metric in MeritNama — % of Max, closing merit, percentile, trend, confidence, volatility, and the Safe / Target / Reach bands.",
};

/**
 * How to Use MeritNama.
 *
 * The original's framing, kept: "A complete reference for every term, metric,
 * and feature in the app. Start here if you're new."
 *
 * ## Every number here is checked against the code, not copied from the original
 *
 * A glossary that drifts from the implementation is worse than no glossary,
 * because a reader trusts it precisely where they cannot check. The bucket
 * thresholds, the projection arithmetic and the confidence bands below were
 * each read out of `@/lib/predict/predict.ts` while writing this page.
 *
 * Two of the original's entries are deliberately corrected rather than copied:
 *
 * - Its quota list ("Open Merit, Women, Disabled, Minority") is not what our
 *   data contains. The real quota names, from the seat matrix, are Punjab,
 *   Armed Force, AJK/G&B/ICT, KPK/Sindh/Balochistan, Foriegn (sic), Disable,
 *   Dental and Placement — the misspelling included, because that is what the
 *   portal publishes and what a filter has to match.
 * - Its "how to update Previous Merit Lists" FAQ tells the reader to hand-edit
 *   `data/current_merit.json`. That was true of a static site. Here the merit
 *   lists come from the database via an ingest pipeline, so the answer would
 *   send someone to edit a file that no longer drives anything.
 */

const STEPS = [
  {
    n: 1,
    title: "Calculate your merit score",
    href: "/app/calculator",
    linkLabel: "Calculator",
    body: "Fill in your MBBS/BDS aggregate, house job, MDCAT and the rest. Your score is computed against the formula in force for the current cycle — not a generic one — and nothing about which components exist is written in code, so it stays correct when the policy changes.",
  },
  {
    n: 2,
    title: "See your percentile and options",
    href: "/app/prediction",
    linkLabel: "My Prediction",
    body: "Your score is normalised to % of the policy maximum and ranked against every historical closing merit. You get a percentile, a merit band, and a Safe / Target / Reach list with a projected range for each specialty–hospital combination.",
  },
  {
    n: 3,
    title: "Explore the merit table",
    href: "/app/merit",
    linkLabel: "Merit Table",
    body: "Every specialty × hospital × programme × quota combination with year-by-year closing merits. Open a row for the full trend, the seat count, and the history behind the average.",
  },
  {
    n: 4,
    title: "Follow the live cycle",
    href: "/app/portal",
    linkLabel: "Induction Portal",
    body: "Published merit lists round by round, who consented, who actually joined, how contested each seat is, and simulations of what happens next. This is the cycle that is open now, rather than the ones that closed.",
  },
];

export default function GuidePage() {
  return (
    <div>
      <VerseStrip />

      <div className="mx-auto max-w-[1000px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <Eyebrow>Resources</Eyebrow>

          <h1 className="mt-6 max-w-[16ch] font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl">
            How to use
            <span className="block text-accent">MeritNama</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            A reference for every term and metric in the app. Start here if
            you’re new.
          </p>
        </Reveal>

        {/* ── Quick start ─────────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="font-sans text-lg font-bold text-foreground">
            Four steps
          </h2>

          <div className="mt-5 flex flex-col gap-px bg-border">
            {STEPS.map((step) => (
              <div key={step.n} className="bg-background flex items-start gap-4 p-5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-quiet font-mono text-sm font-bold text-accent">
                  {step.n}
                </span>
                <div className="min-w-0">
                  <h3 className="font-sans text-sm font-bold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
                    {step.body}
                  </p>
                  <Link
                    href={step.href}
                    className="mt-2 inline-block font-mono text-[11px] font-bold uppercase tracking-wider text-accent underline"
                  >
                    Open {step.linkLabel}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Glossary ────────────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="font-sans text-lg font-bold text-foreground">
            Glossary
          </h2>

          <div className="mt-5 flex flex-col gap-px bg-border">
            <Term name="% of Max" tag="Normalisation" id="pct-of-max">
              <p>
                The scoring formula changed between cycles — the maximum was 95
                marks in Induction 8 and 30 in Induction 21. A closing merit of
                32 in one cycle is therefore a completely different achievement
                from a 32 in another.
              </p>
              <Formula>
                % of Max = (closing merit ÷ that cycle’s total marks) × 100
              </Formula>
              <p>
                Every comparison, average, percentile and chart on this site
                uses the normalised value. See{" "}
                <Link href="/app/policy" className="font-bold text-accent underline">
                  Scoring Policy History
                </Link>{" "}
                for what changed and when.
              </p>
              <Example>
                A closing merit of 24 out of 30 is 80% of max. The same raw 24
                in a 95-mark cycle would be 25.3% — the raw numbers are simply
                not comparable.
              </Example>
            </Term>

            <Term name="Closing merit (cutoff)" tag="Core data" id="closing-merit">
              <p>
                The <strong className="text-foreground">lowest</strong> merit
                among candidates actually allocated a seat in a given specialty,
                hospital, programme and quota. If your score is at or above it,
                you would have qualified for that seat in that cycle.
              </p>
              <p>
                Sourced from published PHF merit lists and gazette
                notifications — never estimated.
              </p>
            </Term>

            <Term name="Opening merit" tag="Core data" id="opening-merit">
              <p>
                The <strong className="text-foreground">highest</strong> merit
                among candidates allocated that seat — the first person
                selected. Together with the closing merit it gives the full
                range of admitted scores.
              </p>
              <Example>
                Opening 26.0 and closing 24.5 out of 30 means every admitted
                candidate scored inside that 1.5-mark band. A narrow gap means
                tight competition; a wide one means more spread.
              </Example>
            </Term>

            <Term name="Percentile" tag="My Prediction" id="percentile">
              <p>
                What fraction of all specialty–hospital combinations have a
                historical average closing merit below your score.
              </p>
              <Formula>
                Percentile = combinations with average below yours ÷ all
                combinations × 100
              </Formula>
              <ul className="flex flex-col gap-1.5">
                <Bullet>
                  <strong className="text-foreground">90th</strong> — your score
                  exceeds 90% of historical averages; almost everything is
                  accessible.
                </Bullet>
                <Bullet>
                  <strong className="text-foreground">50th</strong> — the
                  median; half the options are within reach.
                </Bullet>
                <Bullet>
                  <strong className="text-foreground">20th</strong> — most
                  competitive specialties sit above you, but many options
                  remain.
                </Bullet>
              </ul>
              <Note>
                Computed on normalised % of Max, so it stays meaningful even
                though the formula changed between cycles.
              </Note>
            </Term>

            <Term name="Safe / Target / Reach" tag="My Prediction" id="buckets">
              <p>
                Each option is placed in one of three bands by comparing your
                normalised score to that seat’s historical average.
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <Pill tone="safe">Safe</Pill>
                  <span className="text-sm text-fg-muted">
                    at least <strong className="text-foreground">3 points above</strong>{" "}
                    the average.
                  </span>
                </div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <Pill tone="accent">Target</Pill>
                  <span className="text-sm text-fg-muted">
                    within <strong className="text-foreground">5 points below</strong>{" "}
                    it — the competitive zone, where trend and volatility matter
                    most.
                  </span>
                </div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <Pill tone="reach">Reach</Pill>
                  <span className="text-sm text-fg-muted">
                    between 5 and{" "}
                    <strong className="text-foreground">15 points below</strong> —
                    unlikely but not impossible, especially if the trend is
                    falling.
                  </span>
                </div>
              </div>
              <Note>
                Anything more than 15 points below the average is dropped
                entirely rather than shown as a fourth band. A seat that far out
                of range is not a long shot, it is not an option, and listing it
                would pad the result with false hope.
              </Note>
            </Term>

            <Term name="Trend" tag="Prediction & table" id="trend">
              <p>
                The direction of a seat’s closing merit over recent
                cycles, from the slope of its % of Max values.
              </p>
              <ul className="flex flex-col gap-1.5">
                <Bullet>
                  <strong className="text-status-danger">Rising</strong> — demand
                  is growing; harder to secure than it was.
                </Bullet>
                <Bullet>
                  <strong className="text-status-safe">Falling</strong> —
                  competition easing. An opportunity if you are borderline.
                </Bullet>
                <Bullet>
                  <strong className="text-foreground">Stable</strong> — no clear
                  direction; the historical average is a reasonable guide.
                </Bullet>
              </ul>
            </Term>

            <Term name="Confidence" tag="Prediction & table" id="confidence">
              <p>
                How much history a seat has, and therefore how much weight its
                average deserves.
              </p>
              <ul className="flex flex-col gap-1.5">
                <Bullet>
                  <strong className="text-foreground">High</strong> — four or
                  more cycles of data; the pattern is established.
                </Bullet>
                <Bullet>
                  <strong className="text-foreground">Medium</strong> — two or
                  three cycles; some evidence, treat with caution.
                </Bullet>
                <Bullet>
                  <strong className="text-foreground">Low</strong> — one cycle.
                  The “average” is a single data point; treat any
                  prediction as speculative.
                </Bullet>
              </ul>
            </Term>

            <Term name="Volatility" tag="Merit table" id="volatility">
              <p>
                How much a seat’s closing merit has swung between cycles —
                the standard deviation of its % of Max values.
              </p>
              <ul className="flex flex-col gap-1.5">
                <Bullet>
                  <strong className="text-foreground">Low</strong> — under 2
                  points. Predictable.
                </Bullet>
                <Bullet>
                  <strong className="text-foreground">Medium</strong> — 2 to 5
                  points. Consider the range, not just the average.
                </Bullet>
                <Bullet>
                  <strong className="text-foreground">High</strong> — over 5
                  points. The average alone tells you little.
                </Bullet>
              </ul>
              <Example>
                A low-volatility seat whose average sits slightly above your
                score is often a better bet than a high-volatility one whose
                average sits below it.
              </Example>
            </Term>

            <Term name="Trend projection" tag="My Prediction" id="projection">
              <p>
                The projected range shown against each prediction. It is
                deliberately crude, and the app does not dress it up as a model.
              </p>
              <Formula>
                Projected range = latest close ± trend shift ± volatility band
              </Formula>
              <ul className="flex flex-col gap-1.5">
                <Bullet>
                  A rising trend adds 2 points, falling subtracts 2, stable adds
                  nothing.
                </Bullet>
                <Bullet>
                  High volatility widens the band to ±6 points, medium to ±3,
                  low to ±1.5.
                </Bullet>
              </ul>
              <Note>
                It is “last cycle, nudged” — not a forecast. Policy
                changes, seat withdrawals and who happens to apply all move a
                real cutoff in ways no amount of history predicts.
              </Note>
            </Term>

            <Term name="Quota" tag="Core data" id="quota">
              <p>
                Seats are allocated under separate quota categories, each with
                its own merit list and its own cutoff — so the same specialty at
                the same hospital can close at very different scores depending
                on quota.
              </p>
              <p>
                The quotas in this cycle’s seat matrix are{" "}
                <strong className="text-foreground">
                  Punjab, Armed Force, AJK/G&amp;B/ICT, KPK/Sindh/Balochistan,
                  Foriegn, Disable, Dental
                </strong>{" "}
                and <strong className="text-foreground">Placement</strong>.
                Always filter to the quota you are actually eligible for before
                reading any prediction.
              </p>
              <Note>
                “Foriegn” and “Disable” are spelled that
                way in the official data. We match the published spelling rather
                than correcting it, because a filter has to join to what the
                portal actually publishes.
              </Note>
            </Term>

            <Term name="Induction number" tag="Core data" id="induction">
              <p>
                PHF numbers its cycles sequentially. This site holds Induction 8
                onward, and displays each one by its year.
              </p>
              <Note>
                A year can contain more than one induction — 2021 ran 9 and 10,
                2023 ran 13 and 14, 2025 ran 17 through 19 — so where two cycles
                would otherwise look identical the induction number is shown
                alongside the year.
              </Note>
            </Term>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="font-sans text-lg font-bold text-foreground">
            Frequently asked
          </h2>

          <div className="mt-5 flex flex-col gap-px bg-border">
            <Faq q="Why does my calculated score look nothing like the historical numbers?">
              Historical values are closing merits from past cycles, scored
              under the formula in force at the time — often out of 95 marks.
              Your calculated score uses the current formula, out of 30. That is
              exactly why % of Max exists: it is the only way to compare the two
              fairly.
            </Faq>

            <Faq q="What is the difference between the Merit Table and My Prediction?">
              The Merit Table is a data explorer — every combination, sortable
              and filterable, with full history. My Prediction is a decision
              tool — you supply your score and it ranks every option relative to
              you.
            </Faq>

            <Faq q="How accurate are the predictions?">
              They are extrapolations from history and nothing more. Treat Safe
              as likely but not guaranteed, Target as genuinely competitive, and
              Reach as worth considering mainly when the trend is falling.
              Always check the confidence label — a seat with one cycle of data
              has an “average” that is a single number.
            </Faq>

            <Faq q="Why is the percentile based on % of Max rather than raw marks?">
              Because raw marks cannot be compared across cycles when the
              maximum changed from 95 to 30. Normalising first is what makes a
              percentile across the whole multi-cycle dataset mean anything.
            </Faq>

            <Faq q="Where does the data come from?">
              Published PHF merit lists, gazette notifications and the portal's
              own exports. Nothing here is crowd-sourced, and nothing is
              scraped from a live candidate feed.
            </Faq>

            <Faq q="Why does the portal show fewer people than applied?">
              Because most pages count only candidates who cleared verification
              — the default status scope. The Candidate Pool shows the full
              3,474, and Config lets you widen the scope if you want to ask what
              happens when unverified candidates are included.
            </Faq>
          </div>
        </section>

        {/* ── Disclaimer ──────────────────────────────────────────────────── */}
        <Bezel className="mt-12" innerClassName="flex items-start gap-3 p-6">
          <AlertIcon className="mt-0.5 h-4 w-auto shrink-0 text-status-reach" />
          <div>
            <p className="font-sans text-sm font-bold text-status-reach">
              Not affiliated with PHF, PGMI, or any government body.
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-fg-muted">
              MeritNama is an independent tool built on publicly published merit
              lists and gazette notifications. Everything here is for
              information only.{" "}
              <strong className="text-foreground">
                Never make an application decision on this alone
              </strong>{" "}
              — verify closing merits, eligibility and deadlines directly with
              PHF.
            </p>
          </div>
        </Bezel>
      </div>
    </div>
  );
}

function Term({
  name,
  tag,
  id,
  children,
}: {
  name: string;
  tag: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    // A row in the glossary's hairline stack: opaque so the seam colour shows
    // only between terms.
    <div className="bg-background p-6">
      {/* `scroll-mt` so a deep link does not park the heading under the sticky
          header — the app shell's is `h-16`. */}
      <div id={id} className="scroll-mt-20">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-sans text-base font-bold text-foreground">{name}</h3>
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-subtle">
            {tag}
          </span>
        </div>
        <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-fg-muted">
          {children}
        </div>
      </div>
    </div>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-sm bg-surface-sunken p-3 font-mono text-[12px] text-foreground">
      {children}
    </div>
  );
}

function Example({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l-2 border-accent/40 pl-3 text-xs leading-relaxed text-fg-subtle">
      <strong className="text-fg-muted">Example:</strong> {children}
    </p>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs leading-relaxed text-fg-subtle">{children}</p>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm leading-relaxed text-fg-muted">
      <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/**
 * A `<details>`, not a click-to-toggle div.
 *
 * It is open-able before hydration, findable by the browser's own in-page
 * search, and needs no state — which is the whole reason the element exists.
 */
function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="bg-background">
      <details className="group">
        <summary className="flex cursor-pointer items-center justify-between gap-3 p-5 font-sans text-sm font-bold text-foreground marker:content-['']">
          {q}
          <span
            aria-hidden
            className="shrink-0 font-mono text-fg-subtle transition-transform duration-[200ms] group-open:rotate-45"
          >
            +
          </span>
        </summary>
        <p className="px-5 pb-5 text-sm leading-relaxed text-fg-muted">
          {children}
        </p>
      </details>
    </div>
  );
}
