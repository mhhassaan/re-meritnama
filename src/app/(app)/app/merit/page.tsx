import type { Metadata } from "next";
import { loadCycles, loadFacets, loadMeritRows } from "@/lib/merit/data";
import { MeritBrowser } from "@/components/merit/merit-browser";
import { VerseStrip } from "@/components/app/verse-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";

export const metadata: Metadata = {
  title: "Merit Table | MeritNama",
  description:
    "Historical closing merits by specialty, hospital, programme and quota, year by year, for Punjab residency inductions.",
};

/**
 * Merit Table.
 *
 * Reads only public aggregates — closing merits per seat combination, with no
 * personal fields — so it needs no candidate data at all. It still sits inside
 * the authenticated (app) group, matching the original: sign-in is required so
 * bulk scraping is attributable and the invite-only model holds.
 */
export default async function MeritTablePage() {
  const [rows, cycles, facets] = await Promise.all([
    loadMeritRows(),
    loadCycles(),
    loadFacets(),
  ]);

  const first = cycles[0];
  const last = cycles[cycles.length - 1];

  return (
    <div>
      <VerseStrip />

      <div className="mx-auto max-w-[1600px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        {/* Editorial split: the claim on the left, the shape of the evidence on
            the right. Collapses to a single column below `lg`, where the
            figures sit under the sentence they qualify. */}
        <header className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-16">
          <Reveal>
            <Eyebrow>Merit Table</Eyebrow>

            <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] text-balance sm:text-6xl">
              Closing merits,{" "}
              <span className="text-accent">
                {first.label}–{last.label}
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
              What each seat actually closed at. Click any row for the
              year-by-year breakdown.
            </p>
          </Reveal>

          <Reveal delay={120}>
            <Bezel className="lg:min-w-[15rem]">
              <dl className="divide-y divide-border">
                <Figure
                  label="Records"
                  value={rows.length.toLocaleString("en-GB")}
                />
                <Figure label="Years covered" value={String(cycles.length)} />
                <Figure label="Latest year" value={last.label} />
              </dl>
            </Bezel>
          </Reveal>
        </header>

        {/* Deliberately NOT wrapped in <Reveal>. A transformed ancestor becomes
            the containing block for `position: fixed`, so the mobile filter
            sheet anchored to the bottom of the whole results list — thousands
            of pixels below the viewport — instead of the screen. Entry
            animation is not worth breaking a modal for. */}
        <div className="mt-16 md:mt-20">
          <MeritBrowser rows={rows} cycles={cycles} facets={facets} />
        </div>

        <p className="mt-20 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          Historical data from official PHF merit lists. Past figures
          indicate but never guarantee — check seat counts and official lists
          with PHF before deciding.
        </p>
      </div>
    </div>
  );
}

/** One figure in the header panel. Numerics are monospaced, per the guidelines. */
function Figure({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-8 px-5 py-4">
      <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
        {label}
      </dt>
      <dd className="font-mono text-lg font-bold tabular-nums text-foreground">
        {value}
        {hint && (
          <span className="ml-1.5 text-xs font-normal text-fg-subtle">
            {hint}
          </span>
        )}
      </dd>
    </div>
  );
}
