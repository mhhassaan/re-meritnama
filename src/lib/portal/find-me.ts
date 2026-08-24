"use server";

import { createClient } from "@/lib/supabase/server";
import { CURRENT_INDUCTION } from "@/lib/induction";

/**
 * Find my position.
 *
 * The original's identity bar: type an applicant id, and every row belonging to
 * that person is highlighted across the portal.
 *
 * ## What this deliberately does not do
 *
 * It looks the id up in `merit_entries` — Tier 1, read **as the caller**, the
 * same rows the page is already showing. It does not touch `candidates` and it
 * does not touch the applicant pool, so it can return nothing the reader could
 * not already find by scrolling.
 *
 * That matters because an applicant id is not a secret and never was: they are
 * 3–5 digit numbers, printed on every published merit list, and the historic
 * leak published the lot. Anything gated on knowing one is not gated at all. So
 * this returns only what the gazette prints, and an id that has never been
 * published returns nothing rather than confirming the person exists.
 */

export type Appearance = {
  round: number;
  program: string;
  quota: string;
  specialty: string;
  hospital: string;
  marks: number | null;
  preferenceNo: number | null;
  consent: string | null;
};

export type FoundCandidate = {
  applicantId: number;
  name: string;
  pmdc: string | null;
  /** Every seat they appear at in this cycle, latest round first. */
  appearances: Appearance[];
};

export type FindResult =
  | { ok: true; candidate: FoundCandidate }
  | { ok: false; error: string };

export async function findMyPosition(
  applicantIdInput: string,
  induction: number = CURRENT_INDUCTION
): Promise<FindResult> {
  const applicantId = Number(String(applicantIdInput).trim());

  if (!Number.isInteger(applicantId) || applicantId <= 0) {
    return { ok: false, error: "Enter a numeric applicant ID." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("merit_entries")
    .select(
      "round, program, quota, specialty, hospital, marks_total, preference_no, consent_status, name_full, pmdc_no"
    )
    .eq("induction", induction)
    .eq("applicant_id", applicantId)
    .order("round", { ascending: false });

  // An RLS denial and an id that does not exist are answered identically. The
  // difference would tell an unverified caller whether a given doctor is in the
  // cycle, which is precisely what the gate exists to prevent.
  if (error || !data?.length) {
    return {
      ok: false,
      error: `No published merit entry for applicant ${applicantId} in this cycle.`,
    };
  }

  return {
    ok: true,
    candidate: {
      applicantId,
      name: data[0].name_full,
      pmdc: data[0].pmdc_no,
      appearances: data.map((row) => ({
        round: row.round,
        program: row.program,
        quota: row.quota,
        specialty: row.specialty,
        hospital: row.hospital,
        marks: row.marks_total != null ? Number(row.marks_total) : null,
        preferenceNo: row.preference_no,
        consent: row.consent_status,
      })),
    },
  };
}
