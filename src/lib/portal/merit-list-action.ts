"use server";

import { createClient } from "@/lib/supabase/server";
import { CURRENT_INDUCTION } from "@/lib/induction";
import {
  loadMeritList,
  type ConsentState,
  type MeritListFilters,
  type MeritSlot,
} from "./merit-list";

/**
 * The next page of Merit List seats.
 *
 * The page renders the first `SLOTS_PER_PAGE` seats and the client appends the
 * rest as they are asked for, rather than navigating. Rendering the whole round
 * at once cost 7.7 MB of HTML and 23,893 DOM nodes; sending it all up front and
 * revealing it in the browser would move the cost but not remove it, since the
 * data would still be in the payload.
 *
 * ## Gate
 *
 * The queues are derived from `applicants`, which is read with the service role
 * and which no client role may touch. The check reuses the existing policy
 * rather than restating it: `seats` is readable only by a verified user, so a
 * read that comes back empty stops the action. Copying the rule here would give
 * it a second place to drift out of agreement with the database.
 */

async function isVerified(induction: number): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seats")
    .select("id")
    .eq("induction", induction)
    .limit(1);
  return Boolean(data?.length);
}

export type MoreSlotsRequest = {
  round: number;
  program?: string;
  specialty?: string;
  hospital?: string;
  quota?: string;
  consent?: ConsentState;
  search?: string;
  page: number;
};

export type MoreSlotsResult =
  | { ok: true; slots: MeritSlot[]; page: number; pageCount: number }
  | { ok: false; reason: "unverified" };

export async function moreMeritSlots(
  request: MoreSlotsRequest
): Promise<MoreSlotsResult> {
  if (!(await isVerified(CURRENT_INDUCTION))) {
    return { ok: false, reason: "unverified" };
  }

  const filters: MeritListFilters = {
    round: request.round,
    program: request.program,
    specialty: request.specialty,
    hospital: request.hospital,
    quota: request.quota,
    consent: request.consent,
    search: request.search,
    page: request.page,
  };

  const view = await loadMeritList(filters);

  return {
    ok: true,
    slots: view.slots,
    page: view.page,
    pageCount: view.pageCount,
  };
}
