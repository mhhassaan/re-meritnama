import type { Metadata } from "next";
import { Suspense } from "react";
import { loadSeats } from "@/lib/portal/data";
import { CURRENT_INDUCTION } from "@/lib/induction";
import { loadCycleSummaries } from "@/lib/merit/data";
import { SeatsBrowser } from "@/components/portal/seats-browser";
import { SeatsByProgram } from "@/components/portal/seats-by-program";
import { PortalQuoteStrip } from "@/components/portal/quote-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { AlertIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Training Seats | Induction Portal | MeritNama",
  description:
    "Every training seat in the cycle by programme, quota, specialty and hospital.",
};

/**
 * Training Seats.
 *
 * What exists, before any question of who gets it. The Overview's quick start
 * sends people here at step 2 — "so you know what exists and what is currently
 * open" — and it is the denominator behind every other number in the portal.
 *
 * Capacity carries no personal data, so this is read as the caller under the
 * ordinary verified-user policy and served from the shared cache.
 */
export default async function TrainingSeatsPage() {
  const [seats, cycles] = await Promise.all([loadSeats(), loadCycleSummaries()]);

  const total = seats.reduce((sum, s) => sum + s.seats, 0);
  const cycle = cycles.find((c) => c.induction === CURRENT_INDUCTION);

  const byProgram = new Map<string, number>();
  for (const seat of seats) {
    byProgram.set(seat.program, (byProgram.get(seat.program) ?? 0) + seat.seats);
  }
  const programSeats = [...byProgram.entries()]
    .map(([program, count]) => ({ program, seats: count }))
    .sort((a, b) => b.seats - a.seats);

  const hospitals = new Set(seats.map((s) => s.hospital));
  const specialties = new Set(seats.map((s) => s.specialty));

  return (
    <div>
      <PortalQuoteStrip />

      <div className="mx-auto max-w-[1600px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <Eyebrow>Induction Portal</Eyebrow>

          <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl text-balance">
            Training seats,{" "}
            <span className="text-accent">all of them</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            Every seat in the cycle by programme, quota, specialty and
            hospital.
          </p>
        </Reveal>

        <Bezel
          className="mt-12"
          innerClassName="grid grid-cols-2 overflow-clip sm:grid-cols-3 lg:grid-cols-5"
        >
          <Meta label="Cycle" value={cycle?.labelWithInduction ?? `Ind ${CURRENT_INDUCTION}`} />
          <Meta label="Seats" value={total.toLocaleString("en-GB")} />
          {/* A slot is one (programme, quota, specialty, hospital); several
              slots carry more than one seat, so the two numbers differ and
              conflating them overstates how many places exist. */}
          <Meta label="Slots" value={seats.length.toLocaleString("en-GB")} />
          <Meta label="Specialties" value={String(specialties.size)} />
          <Meta label="Hospitals" value={String(hospitals.size)} />
        </Bezel>

        <Bezel className="mt-6" innerClassName="p-6">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
            By programme
          </p>
          <div className="mt-4">
            <SeatsByProgram data={programSeats} />
          </div>
        </Bezel>

        <Suspense fallback={null}>
          <SeatsBrowser seats={seats} />
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
    <div className="-ml-px -mt-px border-l border-t border-border bg-surface p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-bold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
