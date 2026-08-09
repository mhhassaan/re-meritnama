import type { Metadata } from "next";
import { loadFacets, loadInductions, loadMeritRows } from "@/lib/merit/data";
import { MeritBrowser } from "@/components/merit/merit-browser";
import { VerseStrip } from "@/components/app/verse-strip";

export const metadata: Metadata = {
  title: "Merit Table | MeritNama",
  description:
    "Historical closing merits by specialty, hospital, programme and quota across Punjab residency induction cycles.",
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
  const [rows, inductions, facets] = await Promise.all([
    loadMeritRows(),
    loadInductions(),
    loadFacets(),
  ]);

  return (
    <div>
      <VerseStrip />

      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.38em] text-accent">
          Merit Table
        </p>
        <h1 className="mt-3 font-sans text-3xl font-black tracking-tight sm:text-4xl">
          Closing merits, {inductions.length} cycles
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-fg-muted">
          What each seat actually closed at, by specialty, hospital, programme
          and quota. Trend and confidence are derived from how many cycles of
          data exist for that combination — a projection from eleven years is a
          different claim from one built on two.
        </p>

        <div className="mt-8">
          <MeritBrowser rows={rows} inductions={inductions} facets={facets} />
        </div>

        <p className="mt-10 border-t border-border pt-5 text-xs leading-relaxed text-fg-subtle">
          Historical data only, sourced from official PHF merit lists. Closing
          merits shift with applicant numbers, seat counts and policy changes, so
          past figures indicate but never guarantee. Verify eligibility, seat
          counts and official lists with PHF, PMDC and PGMI before making
          application decisions.
        </p>
      </div>
    </div>
  );
}
