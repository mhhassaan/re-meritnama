"use server";

import { runConsentWhatIf, type ConsentMode, type ConsentWhatIfResult } from "./consent-whatif";

/**
 * Runs Consent What-If on demand, from the client.
 *
 * Deliberately an action rather than a `?program=&id=` page. This is
 * "simulate", not "browse": the reader clicks Run, gets an answer, and the
 * page never has to redo two full placement runs just because the browser
 * back button fired or a page-level filter changed. `simulate.ts` uses the
 * same shape for the same reason.
 */
export async function runConsentWhatIfAction(
  program: string,
  applicantId: number,
  mode: ConsentMode
): Promise<ConsentWhatIfResult> {
  if (!Number.isInteger(applicantId) || applicantId <= 0) {
    return { ok: false, reason: "not-found" };
  }
  return runConsentWhatIf(program, applicantId, mode);
}
