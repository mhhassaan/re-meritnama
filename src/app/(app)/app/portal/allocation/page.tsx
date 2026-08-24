import type { Metadata } from "next";
import { Suspense } from "react";
import { runAllocation } from "@/lib/portal/data";
import { activeScope } from "@/lib/portal/config";
import { AllocationBrowser } from "@/components/portal/allocation-browser";
import { PortalQuoteStrip } from "@/components/portal/quote-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { AlertIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Seat Allocation | MeritNama",
  description:
    "Simulated seat allocation across every hospital and specialty for a programme, with the cutoff and next in line for each seat.",
};

/**
 * Seat Allocation.
 *
 * Runs the blank-slate allocation for one programme over the whole applicant
 * pool and renders a card per seat: filled out of capacity, the cutoff, who
 * landed there, and who is first in line if someone withdraws.
 *
 * The run happens on the server. The original does it in the browser, and pays
 * for that by shipping every applicant's record to every visitor — which is
 * exactly how it leaked. Here the pool never leaves the server; what reaches
 * the client is placements and counts.
 */
export default async function AllocationPage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string; q?: string }>;
}) {
  const params = await searchParams;
  const program = params.program ?? "FCPS";

  const [allocation, scope] = await Promise.all([
    runAllocation(program),
    activeScope(),
  ]);

  return (
    <div>
      <PortalQuoteStrip />

      <div className="mx-auto max-w-[1600px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <Eyebrow>Induction Portal</Eyebrow>

          <h1 className="mt-6 max-w-[16ch] font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl">
            Seat allocation,
            <span className="block text-accent">simulated</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            Every applicant walks their preference list in order and the highest
            mark wins each seat, exactly as the portal allocates. This is a
            planning aid, not the official result.
          </p>
        </Reveal>

        <Suspense fallback={null}>
          <AllocationBrowser
            program={allocation.program}
            programs={allocation.programs}
            stats={allocation.result.stats}
            poolSize={allocation.poolSize}
            scopeLabel={scope.label}
            slots={allocation.result.slots.map((slot) => ({
              quota: slot.quota,
              specialty: slot.specialty,
              hospital: slot.hospital,
              capacity: slot.capacity,
              cutoff: slot.cutoff,
              placed: slot.placed.map((c) => ({
                applicantId: c.applicantId,
                // Published names only. Anyone who never placed in a real round
                // has never been published by anyone, and a simulation is not
                // the surface that changes that.
                name: allocation.names.get(c.applicantId) ?? null,
                mark: c.mark,
                preferenceNo: c.preferenceNo,
                track: c.track,
              })),
              nextInLine: slot.nextInLine
                ? {
                    applicantId: slot.nextInLine.applicantId,
                    name: allocation.names.get(slot.nextInLine.applicantId) ?? null,
                    mark: slot.nextInLine.mark,
                    preferenceNo: slot.nextInLine.preferenceNo,
                    track: slot.nextInLine.track,
                  }
                : null,
              contenders: slot.others.filter((o) => !o.placedElsewhereAtBetterPreference)
                .length,
            }))}
          />
        </Suspense>

        <p className="mt-16 flex items-start gap-2.5 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          <AlertIcon className="mt-px h-4 w-auto shrink-0 text-status-reach" />
          <span>
            <span className="font-bold text-status-reach">Simulation only.</span>{" "}
            The official allocation applies eligibility rulings, grievance
            outcomes and corrections that are not published anywhere this tool
            can read. Treat a predicted seat as an indication of where you sit
            in the competition, never as an offer.
          </span>
        </p>
      </div>
    </div>
  );
}
