import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CURRENT_INDUCTION } from "@/lib/induction";

/**
 * Access request submission.
 *
 * This route replaces the original flow's client-side verification, which
 * fetched `candidate_auth_index.json` into the browser — every registered
 * email plus an unsalted SHA-256 of the applicant id, which is a short number
 * and therefore reversible in seconds. Shipping that file to verify a claim
 * handed out the entire credential list to do it.
 *
 * Here the candidate index never leaves the server. The browser sends an email
 * and an applicant id; the server checks them against the private `candidates`
 * table and returns only whether they matched.
 *
 * What this does NOT do is prove identity. Email and applicant id are both
 * published (and both are in the historic leak), so anyone can submit a
 * plausible request for anyone. Identity is proven later, by delivery: the
 * account credential is only ever sent to the address already on the candidate
 * record. That was the real mechanism in the original system too, whether or
 * not it was designed that way.
 */

/** Uniform delay so timing cannot distinguish "no such email" from "wrong id". */
const MIN_RESPONSE_MS = 400;

type Payload = {
  email?: unknown;
  applicantId?: unknown;
  message?: unknown;
  paymentDeclared?: unknown;
  paymentAmountPkr?: unknown;
  paymentReference?: unknown;
};

function asTrimmedString(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  const settle = async (status: number, body: Record<string, unknown>) => {
    const elapsed = Date.now() - startedAt;
    if (elapsed < MIN_RESPONSE_MS) {
      await new Promise((r) => setTimeout(r, MIN_RESPONSE_MS - elapsed));
    }
    return NextResponse.json(body, { status });
  };

  let payload: Payload;
  try {
    payload = await request.json();
  } catch {
    return settle(400, { error: "Malformed request." });
  }

  const email = asTrimmedString(payload.email, 254).toLowerCase();
  const applicantId = asTrimmedString(payload.applicantId, 32);
  const message = asTrimmedString(payload.message, 2000);
  const paymentReference = asTrimmedString(payload.paymentReference, 120);
  const paymentDeclared = payload.paymentDeclared === true;

  const amountRaw = Number(payload.paymentAmountPkr);
  const paymentAmountPkr =
    Number.isFinite(amountRaw) && amountRaw >= 0 ? Math.round(amountRaw * 100) / 100 : null;

  if (!email || !applicantId) {
    return settle(400, { error: "Enter both your portal email and Applicant ID." });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return settle(400, { error: "That does not look like a valid email address." });
  }
  if (!/^\d{1,12}$/.test(applicantId)) {
    return settle(400, { error: "Applicant ID should be digits only." });
  }

  // Service role: `candidates` has no read policy for anonymous callers by
  // design, and this lookup must happen before any account exists.
  const db = createAdminClient();

  // Scoped to the current induction: the same applicant number exists in other
  // cycles belonging to different people, so an unscoped lookup could match a
  // record from a previous year.
  const { data: candidate, error: lookupError } = await db
    .from("candidates")
    .select("id, applicant_id, name_full, email_id")
    .eq("applicant_id", Number(applicantId))
    .eq("induction", CURRENT_INDUCTION)
    .maybeSingle();

  if (lookupError) {
    console.error("access-request lookup failed:", lookupError.message);
    return settle(500, { error: "Could not verify your details. Please try again." });
  }

  // One message for both "no such applicant id" and "email does not match it",
  // so the endpoint cannot be used to test whether an id exists or to discover
  // which address is on a given record.
  const matches =
    candidate && (candidate.email_id ?? "").trim().toLowerCase() === email;

  if (!matches) {
    // Recorded so repeated failures against different ids are visible to staff.
    await db.from("access_logs").insert({
      email,
      success: false,
      page: "/api/access-request",
      user_agent: request.headers.get("user-agent"),
    });
    return settle(404, {
      error:
        "We could not match that email and Applicant ID to an Induction 21 record. " +
        "Both must be exactly as they appear on the PHF portal.",
    });
  }

  const { data: existing } = await db
    .from("access_requests")
    .select("status")
    .eq("email", email)
    .eq("induction", CURRENT_INDUCTION)
    .maybeSingle();

  if (existing?.status === "pending") {
    return settle(200, {
      ok: true,
      status: "pending",
      message: "You already have a request awaiting review.",
    });
  }
  if (existing?.status === "approved") {
    return settle(200, {
      ok: true,
      status: "approved",
      message: "This email already has access. Try signing in, or reset your password.",
    });
  }

  const { error: insertError } = await db.from("access_requests").upsert(
    {
      email,
      applicant_id: candidate.applicant_id,
      induction: CURRENT_INDUCTION,
      name_full: candidate.name_full,
      message: message || null,
      status: "pending",
      payment_declared: paymentDeclared,
      payment_amount_pkr: paymentAmountPkr,
      payment_reference: paymentReference || null,
    },
    { onConflict: "email,induction" }
  );

  if (insertError) {
    console.error("access-request insert failed:", insertError.message);
    return settle(500, { error: "Could not save your request. Please try again." });
  }

  await db.from("access_logs").insert({
    email,
    success: true,
    page: "/api/access-request",
    user_agent: request.headers.get("user-agent"),
  });

  return settle(200, {
    ok: true,
    status: "pending",
    // The name is echoed so the candidate can confirm the right record matched.
    // Nothing else from the record is returned.
    nameFull: candidate.name_full,
    message: "Request submitted. Approved requests receive credentials by email.",
  });
}
