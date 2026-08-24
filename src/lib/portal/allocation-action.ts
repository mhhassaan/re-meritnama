"use server";

import { createClient } from "@/lib/supabase/server";
import { CURRENT_INDUCTION } from "@/lib/induction";
import { browseSlot, runAllocation } from "./data";
import { MANUAL_ID_BASE, type ManualCandidate } from "./manual-candidate";

/**
 * Re-runs the allocation with the reader's own entry in the pool.
 *
 * Seat Allocation and Where Merit Falls are server-rendered, and the manual
 * candidate lives in `localStorage` — which the server cannot see while
 * rendering. So the page renders without them first, and the client calls back
 * here when it finds one. That ordering is deliberate: the page is complete and
 * correct for the overwhelming majority who have no manual entry, and nobody
 * waits on a round trip they do not need.
 *
 * The original includes the manual candidate on exactly these two surfaces —
 * its slot browser and its placement both read `allCandidates()` — and
 * excludes it from the Merit List's queues, which read the fetched file
 * directly. We match that split rather than improving on it.
 *
 * Gated the same way as the simulation: `seats` is readable only by a verified
 * user, so a failed read stops the action. Reimplementing the rule would give
 * it a second place to drift.
 */

async function assertVerified(induction: number): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seats")
    .select("id")
    .eq("induction", induction)
    .limit(1);
  return Boolean(data?.length);
}

export type AllocationSlotPayload = {
  quota: string;
  specialty: string;
  hospital: string;
  capacity: number;
  cutoff: number | null;
  placed: Array<{
    applicantId: number;
    name: string | null;
    mark: number;
    preferenceNo: number;
    track: "civilian" | "armed";
  }>;
  nextInLine: {
    applicantId: number;
    name: string | null;
    mark: number;
    preferenceNo: number;
    track: "civilian" | "armed";
  } | null;
  contenders: number;
};

export type AllocationPayload =
  | {
      ok: true;
      program: string;
      poolSize: number;
      stats: {
        passes: number;
        competitors: number;
        placed: number;
        unplaced: number;
        seats: number;
        filled: number;
      };
      slots: AllocationSlotPayload[];
      /** Where the manual candidate landed, so it can be called out. */
      manualSeat: { specialty: string; hospital: string; quota: string } | null;
    }
  | { ok: false; error: string };

export async function allocationWithManual(
  program: string,
  manual: ManualCandidate,
  induction: number = CURRENT_INDUCTION
): Promise<AllocationPayload> {
  if (!(await assertVerified(induction))) {
    return { ok: false, error: "Not available — verify your account." };
  }

  const allocation = await runAllocation(program, induction, manual);

  let manualSeat: { specialty: string; hospital: string; quota: string } | null = null;

  const slots = allocation.result.slots.map((slot) => {
    if (slot.placed.some((c) => c.applicantId === MANUAL_ID_BASE)) {
      manualSeat = {
        specialty: slot.specialty,
        hospital: slot.hospital,
        quota: slot.quota,
      };
    }

    return {
      quota: slot.quota,
      specialty: slot.specialty,
      hospital: slot.hospital,
      capacity: slot.capacity,
      cutoff: slot.cutoff,
      placed: slot.placed.map((c) => ({
        applicantId: c.applicantId,
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
      contenders: slot.others.filter((o) => !o.placedElsewhereAtBetterPreference).length,
    };
  });

  return {
    ok: true,
    program: allocation.program,
    poolSize: allocation.poolSize,
    stats: allocation.result.stats,
    slots,
    manualSeat,
  };
}

export type SlotRowPayload = {
  applicantId: number;
  name: string | null;
  mark: number;
  preferenceNo: number;
  selected: boolean;
  placedHigher: boolean;
};

export type SlotPayload =
  | {
      ok: true;
      capacity: number;
      cutoff: number | null;
      rows: SlotRowPayload[];
    }
  | { ok: false; error: string };

export async function slotWithManual(
  program: string,
  quota: string,
  specialty: string,
  hospital: string,
  manual: ManualCandidate,
  induction: number = CURRENT_INDUCTION
): Promise<SlotPayload> {
  if (!(await assertVerified(induction))) {
    return { ok: false, error: "Not available — verify your account." };
  }

  const allocation = await runAllocation(program, induction, manual);
  const result = browseSlot(allocation, quota, specialty, hospital);

  if (!result.slot) return { ok: false, error: "That seat has no allocation to show." };

  return {
    ok: true,
    capacity: result.capacity,
    cutoff: result.cutoff,
    rows: result.rows,
  };
}
