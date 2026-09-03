import type { Metadata } from "next";
import { Suspense } from "react";
import { loadHospitals } from "@/lib/portal/hospitals";
import { loadHospitalRatings } from "@/lib/community/reviews";
import { CURRENT_INDUCTION } from "@/lib/induction";
import { loadCycleSummaries } from "@/lib/merit/data";
import { HospitalDirectory } from "@/components/portal/hospital-directory";
import { PortalQuoteStrip } from "@/components/portal/quote-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { AlertIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Hospitals | Induction Portal | MeritNama",
  description:
    "Every training hospital in the cycle, with its seats, specialties and programmes.",
};

/**
 * Hospital Directory.
 *
 * The original's framing: "Browse all training hospitals from the Induction
 * Portal seat data. Click a hospital to view its full profile, seat breakdown,
 * and reviews."
 *
 * Everything here comes from the seat matrix. A hospital is not an entity with
 * its own record in this product — it is whatever the seats say trains there —
 * so the directory needs no table of its own.
 */
export default async function HospitalsPage() {
  const [hospitals, ratings, cycles] = await Promise.all([
    loadHospitals(),
    loadHospitalRatings(),
    loadCycleSummaries(),
  ]);

  // A Map does not survive the server/client boundary, so it is flattened to a
  // plain object for the directory component.
  const ratingRows = Object.fromEntries(ratings);

  const cycle = cycles.find((c) => c.induction === CURRENT_INDUCTION);
  const seats = hospitals.reduce((sum, h) => sum + h.seats, 0);
  const specialties = new Set(hospitals.flatMap((h) => h.specialties)).size;

  return (
    <div>
      <PortalQuoteStrip />

      <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <Eyebrow>Induction Portal</Eyebrow>

          <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl text-balance">
            Where the{" "}
            <span className="text-accent">training happens</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            Every training hospital in the cycle, from the seat matrix. Open one
            to see its full seat breakdown by specialty and programme.
          </p>
        </Reveal>

        <Bezel
          className="mt-12"
          innerClassName="grid grid-cols-2 gap-px bg-border sm:grid-cols-4"
        >
          <Meta label="Hospitals" value={String(hospitals.length)} />
          <Meta label="Seats" value={seats.toLocaleString("en-GB")} />
          <Meta label="Specialties" value={String(specialties)} />
          <Meta
            label="Cycle"
            value={cycle?.labelWithInduction ?? `Ind ${CURRENT_INDUCTION}`}
          />
        </Bezel>

        <Suspense fallback={null}>
          <HospitalDirectory hospitals={hospitals} ratings={ratingRows} />
        </Suspense>

        <p className="mt-16 flex items-start gap-2.5 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          <AlertIcon className="mt-px h-4 w-auto shrink-0 text-status-reach" />
          <span>
            Seat counts change between rounds. Confirm against the
            official seat notification before choosing preferences.
          </span>
        </p>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-bold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
