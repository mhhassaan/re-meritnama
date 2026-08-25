import type { Metadata } from "next";
import Link from "next/link";
import { loadPolicyHistory } from "@/lib/policy/data";
import { VerseStrip } from "@/components/app/verse-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { Pill } from "@/components/portal/portal-terms";
import { AlertIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Scoring Policy History | MeritNama",
  description:
    "How the PRP merit formula changed across induction cycles, and why every score on this site is normalised.",
};

/**
 * Scoring Policy History.
 *
 * The original's framing, kept: "How the PRP merit formula evolved across
 * induction cycles — and why normalization is essential for meaningful
 * cross-year analysis."
 *
 * This page is the *explanation* behind a rule the rest of the app applies
 * silently. Every comparison on the site is normalised, and a reader who has
 * not been told the total dropped from 95 marks to 30 has no way to know that
 * a raw 32 in one cycle is not a raw 32 in another.
 *
 * The scale of that change is worth stating with the real numbers rather than
 * the original's illustrative "95 vs 100": the totals in our own data run
 * 95 → 60 → 35 → 30 across Inductions 8 to 21.
 */
export default async function PolicyPage() {
  const { cycles, components, neverUsed } = await loadPolicyHistory();

  const newest = cycles[0];
  const oldest = cycles[cycles.length - 1];

  return (
    <div>
      <VerseStrip />

      <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <Eyebrow>Resources</Eyebrow>

          <h1 className="mt-6 max-w-[18ch] font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl">
            The formula
            <span className="block text-accent">keeps changing</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            How the PRP merit formula evolved across induction cycles — and why
            every score on this site is normalised before anything is compared.
          </p>
        </Reveal>

        {/* ── Why normalisation ───────────────────────────────────────────── */}
        <Bezel className="mt-12" innerClassName="p-6">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
            Cross-year normalisation
          </p>

          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-fg-muted">
            The marks total changed dramatically between cycles — it was{" "}
            <span className="font-mono font-bold text-foreground">
              {oldest?.totalMarks}
            </span>{" "}
            in {oldest?.label} and{" "}
            <span className="font-mono font-bold text-foreground">
              {newest?.totalMarks}
            </span>{" "}
            in {newest?.label}. A closing merit of{" "}
            <span className="font-mono font-bold text-foreground">32</span> in one
            cycle is not the same achievement as a 32 in another, so every score
            here is converted to{" "}
            <strong className="text-foreground">% of that cycle&rsquo;s maximum</strong>{" "}
            before it is ranked, averaged, or charted.
          </p>

          <div className="mt-4 rounded-sm bg-surface-sunken p-4 font-mono text-[13px] text-foreground">
            % of Max = (closing merit ÷ that cycle&rsquo;s total marks) × 100
          </div>

          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-fg-muted">
            This is what <em>% of Max</em> means everywhere in the app. The
            formula in force for the current cycle is applied by the{" "}
            <Link href="/app/calculator" className="font-bold text-accent underline">
              Calculator
            </Link>
            , and the normalised distribution is what{" "}
            <Link href="/app/prediction" className="font-bold text-accent underline">
              My Prediction
            </Link>{" "}
            ranks you against.
          </p>
        </Bezel>

        {/* ── Comparison matrix ───────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="font-sans text-lg font-bold text-foreground">
            Component comparison across cycles
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-fg-muted">
            Marks each component carried, newest cycle first. A dash means the
            component had not been introduced yet;{" "}
            <span className="text-status-danger">dropped</span> means it used to
            carry marks and no longer does — shown rather than hidden, because
            someone who scored well on a since-removed component deserves to see
            that it stopped counting.
          </p>

          <Bezel className="mt-5" innerClassName="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  <Th className="sticky left-0 bg-surface">Component</Th>
                  {cycles.map((c) => (
                    <Th key={c.induction} className="w-24 text-right">
                      {c.label}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {components.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b border-border/60 last:border-b-0"
                  >
                    <Td className="sticky left-0 bg-surface font-sans text-[13px] font-bold text-foreground">
                      {row.label}
                    </Td>
                    {cycles.map((c) => {
                      const state = row.state[c.induction];
                      return (
                        <Td
                          key={c.induction}
                          className="text-right font-mono text-xs tabular-nums"
                        >
                          {state === "active" ? (
                            <span className="text-foreground">
                              {row.byInduction[c.induction]}
                            </span>
                          ) : state === "dropped" ? (
                            <span className="text-status-danger">dropped</span>
                          ) : (
                            <span
                              title="Not part of the formula in this cycle"
                              className="text-fg-subtle"
                            >
                              —
                            </span>
                          )}
                        </Td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="border-t-2 border-border">
                  <Td className="sticky left-0 bg-surface font-sans text-[13px] font-bold text-foreground">
                    Total
                  </Td>
                  {cycles.map((c) => (
                    <Td
                      key={c.induction}
                      className="text-right font-mono text-xs font-bold tabular-nums text-accent"
                    >
                      {c.totalMarks}
                    </Td>
                  ))}
                </tr>
              </tbody>
            </table>
          </Bezel>

          {neverUsed.length > 0 && (
            <p className="mt-3 text-xs leading-relaxed text-fg-subtle">
              {neverUsed.join(", ")}{" "}
              {neverUsed.length === 1 ? "appears" : "appear"} in the policy
              record but never carried marks in any cycle held here, so{" "}
              {neverUsed.length === 1 ? "it is" : "they are"} left out of the
              table above — a row of dashes would say nothing. The Calculator
              lists {neverUsed.length === 1 ? "it" : "them"} under{" "}
              &ldquo;no longer counted&rdquo; for the same reason.
            </p>
          )}
        </section>

        {/* ── Timeline ────────────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="font-sans text-lg font-bold text-foreground">
            Cycle by cycle
          </h2>

          <div className="mt-5 flex flex-col gap-4">
            {cycles.map((cycle) => (
              <Bezel key={cycle.induction} innerClassName="p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-sans text-base font-bold text-foreground">
                      {cycle.label}
                    </h3>
                    {cycle.isCurrent && <Pill tone="accent">Current cycle</Pill>}
                  </div>
                  <p className="font-mono text-sm tabular-nums text-fg-muted">
                    <span className="font-bold text-accent">{cycle.totalMarks}</span>{" "}
                    total marks
                  </p>
                </div>

                {cycle.notes && (
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-fg-muted">
                    {cycle.notes}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {cycle.included.map((component) => (
                    <span
                      key={component.key}
                      className="inline-flex items-baseline gap-2 rounded-sm border border-border-strong px-2.5 py-1"
                    >
                      <span className="text-xs text-foreground">
                        {component.label}
                      </span>
                      <span className="font-mono text-[10px] font-bold tabular-nums text-accent">
                        {component.max_marks}
                      </span>
                    </span>
                  ))}
                  {cycle.removed.map((component) => (
                    <span
                      key={component.key}
                      title="Present in the record but carrying no marks this cycle"
                      className="inline-flex items-baseline gap-2 rounded-sm border border-border px-2.5 py-1 opacity-60"
                    >
                      <span className="text-xs text-fg-subtle line-through">
                        {component.label}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-fg-subtle">
                        dropped
                      </span>
                    </span>
                  ))}
                </div>

                {cycle.tidbits.length > 0 && (
                  <div className="mt-5 border-t border-border pt-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
                      Key notes
                    </p>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {cycle.tidbits.map((tidbit) => (
                        <li
                          key={tidbit}
                          className="flex items-start gap-2 text-xs leading-relaxed text-fg-muted"
                        >
                          <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                          {tidbit}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {cycle.policyRef && (
                  <p className="mt-4 font-mono text-[10px] leading-relaxed text-fg-subtle">
                    Source: {cycle.policyRef}
                  </p>
                )}
              </Bezel>
            ))}
          </div>
        </section>

        <p className="mt-16 flex items-start gap-2.5 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          <AlertIcon className="mt-px h-4 w-auto shrink-0 text-status-reach" />
          <span>
            Policy data is transcribed from PHF notifications. Where a
            notification was unavailable, the entry says so in its source line
            rather than presenting an inference as published fact. Always verify
            the formula for your own cycle against the official document.
          </span>
        </p>
      </div>
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
