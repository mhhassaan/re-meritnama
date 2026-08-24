import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadFacets, loadMeritRows } from "@/lib/merit/data";
import {
  loadCalculatorPolicy,
  loadMeritDistribution,
} from "@/lib/calculator/data";
import { MyPrediction } from "@/components/predict/my-prediction";
import { VerseStrip } from "@/components/app/verse-strip";
import { Reveal } from "@/components/app/reveal";
import { Eyebrow } from "@/components/app/bezel";

export const metadata: Metadata = {
  title: "My Prediction | MeritNama",
  description:
    "Enter your merit score to see your percentile ranking and a personalised list of safe, target and reach options.",
};

/**
 * My Prediction.
 *
 * Reads only aggregates — the same 1,470 rows the merit table uses, plus the
 * scoring policy. The score a candidate types stays in the browser.
 */
export default async function PredictionPage({
  searchParams,
}: {
  searchParams: Promise<{ merit?: string }>;
}) {
  const { merit } = await searchParams;
  const [rows, policy, facets, distribution] = await Promise.all([
    loadMeritRows(),
    loadCalculatorPolicy(),
    loadFacets(),
    loadMeritDistribution(),
  ]);

  // Without a formula there is no scale to normalise a score against, and every
  // figure on the page would be meaningless.
  if (!policy) notFound();

  return (
    <div>
      <VerseStrip />

      <div className="mx-auto max-w-[1600px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <Eyebrow>My Prediction</Eyebrow>

          <h1 className="mt-6 max-w-[18ch] font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl">
            Where your score
            <span className="block text-accent">actually lands</span>
          </h1>

          {/* The original's own description, kept. */}
          <p className="mt-7 max-w-3xl text-[15px] leading-relaxed text-fg-muted">
            Enter your merit score to see your percentile ranking and a
            personalised list of safe, target, and reach options — with
            year-on-year trend and confidence for each combination.
          </p>
        </Reveal>

        <div className="mt-12 md:mt-14">
          <MyPrediction
            rows={rows}
            policy={policy}
            facets={facets}
            distribution={distribution}
            // Sanitised rather than passed through: this lands in a number
            // field, and anything that is not a plain number is discarded.
            initialMerit={
              merit != null && Number.isFinite(Number(merit)) && merit.trim() !== ""
                ? String(Number(merit))
                : ""
            }
          />
        </div>

        <p className="mt-16 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          Predictions compare your score against historical closing merits on a
          normalised scale. They are not a probability of getting a seat — seats,
          applicant numbers and the scoring formula all change between cycles.
          Verify eligibility and official lists with PHF, PMDC and PGMI before
          making application decisions.
        </p>
      </div>
    </div>
  );
}
