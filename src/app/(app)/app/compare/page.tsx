import type { Metadata } from "next";
import { Suspense } from "react";
import { loadCycles, loadMeritRows, loadFacets } from "@/lib/merit/data";
import { CompareTool } from "@/components/compare/compare-tool";
import { VerseStrip } from "@/components/app/verse-strip";
import { Reveal } from "@/components/app/reveal";
import { Eyebrow } from "@/components/app/bezel";

export const metadata: Metadata = {
  title: "Compare Specialties | MeritNama",
  description:
    "Put two or three specialty and hospital combinations side by side and compare their closing merits, trends and seat counts across cycles.",
};

/**
 * Compare Specialties.
 *
 * The rows are aggregates — closing merits per seat combination, no personal
 * fields — so unlike the merit lists this reads from `public/data` rather than
 * the database, and the whole 1,470-row set is loaded server-side and handed to
 * the client component. That is deliberate: the comparison is interactive, the
 * dataset is small enough to hold, and a round trip per dropdown change would
 * make it feel worse for no privacy gain.
 */
export default async function ComparePage() {
  const [rows, cycles, facets] = await Promise.all([
    loadMeritRows(),
    loadCycles(),
    loadFacets(),
  ]);

  return (
    <div>
      <VerseStrip />

      <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <Eyebrow>Compare Specialties</Eyebrow>

          <h1 className="mt-6 max-w-[16ch] font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl">
            Two or three seats,
            <span className="block text-accent">side by side</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            Pick a programme, then the seats you are weighing up.
          </p>
        </Reveal>

        <Suspense fallback={null}>
          <CompareTool
            rows={rows}
            cycles={cycles.map((c) => ({
              induction: c.induction,
              label: c.labelWithInduction,
            }))}
            programs={facets.programs}
          />
        </Suspense>

        <p className="mt-16 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          A closing merit is what the last candidate placed on, not a pass
          mark. Read the Confidence row before the cutoffs.
        </p>
      </div>
    </div>
  );
}
