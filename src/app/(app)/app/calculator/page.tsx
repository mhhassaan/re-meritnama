import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  loadCalculatorPolicy,
  loadMeritDistribution,
} from "@/lib/calculator/data";
import { MeritCalculator } from "@/components/calculator/merit-calculator";
import { VerseStrip } from "@/components/app/verse-strip";
import { Reveal } from "@/components/app/reveal";
import { Eyebrow } from "@/components/app/bezel";

export const metadata: Metadata = {
  title: "Merit Calculator | MeritNama",
  description:
    "Estimate your PHF residency induction merit score from individual components, using the published scoring formula for the current cycle.",
};

/**
 * Merit Calculator.
 *
 * Reads only published policy and aggregate merit data — no candidate record is
 * touched, and nothing the user types leaves the browser. It sits inside the
 * authenticated group because the whole app does, not because the arithmetic is
 * sensitive.
 */
export default async function CalculatorPage() {
  const [policy, distribution] = await Promise.all([
    loadCalculatorPolicy(),
    loadMeritDistribution(),
  ]);

  // No formula for the current cycle means no calculator. Rendering an empty
  // one would invite a candidate to compute a score against nothing.
  if (!policy) notFound();

  return (
    <div>
      <VerseStrip />

      <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <Eyebrow>Merit Calculator</Eyebrow>

          <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl text-balance">
            Work out your{" "}
            <span className="text-accent">merit score</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            Estimate your merit from the individual components, using the
            formula published for the {policy.year} intake. Nothing you enter
            here is sent anywhere or stored — the calculation happens in your
            browser.
          </p>
        </Reveal>

        <div className="mt-14 md:mt-16">
          <MeritCalculator policy={policy} distribution={distribution} />
        </div>
      </div>
    </div>
  );
}
