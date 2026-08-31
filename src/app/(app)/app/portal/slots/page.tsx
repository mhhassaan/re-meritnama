import type { Metadata } from "next";
import { Suspense } from "react";
import { browseSlot, runAllocation } from "@/lib/portal/data";
import { SlotBrowser } from "@/components/portal/slot-browser";
import { PortalQuoteStrip } from "@/components/portal/quote-strip";
import { Reveal } from "@/components/app/reveal";
import { Eyebrow } from "@/components/app/bezel";
import { AlertIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Where Merit Falls | MeritNama",
  description:
    "Everyone who applied for one seat, ranked by the mark that applies to that seat, with the simulated cutoff.",
};

/**
 * Where Merit Falls — one seat, everyone who wants it.
 *
 * The complement to Seat Allocation: that page answers "what happens
 * everywhere", this one answers "what is happening here". Both run the same
 * simulation, which is what lets this page mark who the allocation actually
 * placed and who it expects to land somewhere they wanted more.
 *
 * Ranking is by the mark that applies to THIS seat, not the bare aggregate, so
 * the same two candidates can rank differently at two hospitals in the same
 * specialty — a certificate bonus only counts where the discipline matches.
 */
export default async function SlotsPage({
  searchParams,
}: {
  searchParams: Promise<{
    program?: string;
    quota?: string;
    specialty?: string;
    hospital?: string;
  }>;
}) {
  const params = await searchParams;
  const program = params.program ?? "FCPS";

  const allocation = await runAllocation(program);

  const selection =
    params.quota && params.specialty && params.hospital
      ? browseSlot(allocation, params.quota, params.specialty, params.hospital)
      : null;

  // The pickers cascade, so each level is derived from what the level above
  // left available. Offering a hospital that has no seat under the chosen quota
  // produces an empty result and reads as a bug.
  const slots = allocation.result.slots.map((s) => ({
    quota: s.quota,
    specialty: s.specialty,
    hospital: s.hospital,
    capacity: s.capacity,
  }));

  return (
    <div>
      <PortalQuoteStrip />

      <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <Eyebrow>Induction Portal</Eyebrow>

          <h1 className="mt-6 max-w-[16ch] font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl">
            Where merit
            <span className="block text-accent">falls</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            Pick a seat and see everyone who applied for it, ranked by the
            mark that counts there. The cutoff is where the simulation says the last
            place goes.
          </p>
        </Reveal>

        <Suspense fallback={null}>
          <SlotBrowser
            program={program}
            programs={allocation.programs}
            slots={slots}
            selection={
              selection && selection.slot
                ? {
                    quota: selection.slot.quota,
                    specialty: selection.slot.specialty,
                    hospital: selection.slot.hospital,
                    capacity: selection.capacity,
                    cutoff: selection.cutoff,
                    rows: selection.rows,
                  }
                : null
            }
            selected={{
              quota: params.quota ?? "",
              specialty: params.specialty ?? "",
              hospital: params.hospital ?? "",
            }}
          />
        </Suspense>

        <p className="mt-16 flex items-start gap-2.5 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          <AlertIcon className="mt-px h-4 w-auto shrink-0 text-status-reach" />
          <span>
            <span className="font-bold text-status-reach">Simulation only.</span>{" "}
            A faded row is someone the simulation places at a seat they ranked
            higher, so they are unlikely to take this one — but preferences and
            eligibility change between rounds, and the official allocation
            applies rulings this tool cannot see.
          </span>
        </p>
      </div>
    </div>
  );
}
