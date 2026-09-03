import type { Metadata } from "next";
import { loadSeats } from "@/lib/portal/data";
import { ConsentWhatIfForm } from "@/components/portal/consent-whatif-form";
import { PortalQuoteStrip } from "@/components/portal/quote-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { AlertIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Consent What-If | Induction Portal | MeritNama",
  description:
    "Compare seat allocation with a rerun where one candidate does not consent — the released seat, who moves in, and the subsequent list changes.",
};

/**
 * Consent What-If.
 *
 * Hidden on the deployed site right now — its own `applyMode('merit-list')`
 * hides `[data-tab="consent"]` alongside Where Merit Falls whenever a merit
 * list has been published for the cycle, which Induction 21 has. The pane's
 * markup and its script (`sim-consent.js`) are both still shipped, read
 * directly rather than guessed at, and this is a straight port of them —
 * same precedent as Where Merit Falls and Seat Allocation, which are hidden
 * by the identical gate and were built here anyway.
 *
 * It runs on the **blank-slate placement** engine (`runPlacement`), the one
 * behind Seat Allocation — not the cascade behind Simulate Next Round. See
 * `@/lib/portal/consent-whatif` for why that distinction matters: removing
 * one candidate reopens every seat in the programme to a fresh
 * deferred-acceptance run, so the ripple can reach people who never listed
 * the seat that was released.
 */
export default async function ConsentWhatIfPage() {
  const seats = await loadSeats();
  const programs = [...new Set(seats.map((s) => s.program.trim()))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  return (
    <div>
      <PortalQuoteStrip />

      <div className="mx-auto max-w-[1000px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <Eyebrow>Induction Portal</Eyebrow>

          <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl text-balance">
            If one person{" "}
            <span className="text-accent">said no</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            Compare the normal allocation with a rerun where one candidate
            does not consent.
          </p>
        </Reveal>

        <ConsentWhatIfForm programs={programs} />

        <p className="mt-16 flex items-start gap-2.5 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          <AlertIcon className="mt-px h-4 w-auto shrink-0 text-status-reach" />
          <span>
            <span className="font-bold text-status-reach">Simulation only.</span>{" "}
            This is a blank-slate rerun of the placement algorithm, not a
            prediction of how PHF applies a real withdrawal. It answers one
            narrow question — what changes if this one candidate is removed
            from the pool — and nothing here is sent anywhere or acted on.
          </span>
        </p>
      </div>
    </div>
  );
}
