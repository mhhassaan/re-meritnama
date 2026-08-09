"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";
import { getCurrentRole, isStaffRole } from "@/lib/auth/roles";

/**
 * Server Actions for the staff console.
 *
 * Each action re-checks the caller's role. A Server Action is a public HTTP
 * endpoint — the fact that it is only rendered inside a gated layout does not
 * stop anyone from invoking it directly, so the layout check protects the UI
 * and this check protects the operation.
 *
 * These use the service-role client because approving a request creates an Auth
 * user and writes `candidate_links` and `user_roles`, none of which any policy
 * permits from a client. That is why the role check above is not optional.
 */

type ActionResult = { ok: true; message: string } | { ok: false; error: string };

async function requireStaff(): Promise<{ userId: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  const role = await getCurrentRole();
  if (!isStaffRole(role)) return { error: "Not authorised." };

  return { userId: user.id };
}

export async function approveAccessRequest(
  email: string,
  induction: number
): Promise<ActionResult> {
  const auth = await requireStaff();
  if ("error" in auth) return { ok: false, error: auth.error };

  const db = createAdminClient();

  const { data: req, error: reqError } = await db
    .from("access_requests")
    .select("email, applicant_id, induction, name_full, status")
    .eq("email", email)
    .eq("induction", induction)
    .maybeSingle();

  if (reqError || !req) return { ok: false, error: "Request not found." };
  if (req.status === "approved") {
    return { ok: false, error: "This request has already been approved." };
  }

  // The address is taken from the stored request, which the API route already
  // matched against the candidate record — never from anything the approving
  // screen passes in. This is the step that makes email delivery the actual
  // proof of identity, so it must not be redirectable to another address.
  const targetEmail = req.email;

  // An account may already exist from an earlier cycle. Reuse it rather than
  // failing, otherwise a re-approval is unrecoverable without console access.
  const { data: existingList } = await db.auth.admin.listUsers({ perPage: 1000 });
  const existing = existingList?.users?.find((u) => u.email === targetEmail);

  let userId: string;

  if (existing) {
    userId = existing.id;
  } else {
    const { data: created, error: createError } = await db.auth.admin.inviteUserByEmail(
      targetEmail,
      {
        redirectTo: `${siteUrl()}/auth/callback?next=/auth/update-password`,
        // Surfaced in the invite email so the recipient can verify it concerns
        // their own application. An invite naming the candidate and their
        // applicant id reads as legitimate; a bare "click here" reads as
        // phishing, both to the reader and to spam filters.
        data: {
          display_name: req.name_full ?? undefined,
          applicant_id: req.applicant_id ?? undefined,
          induction: req.induction,
        },
      }
    );

    if (createError || !created?.user) {
      return {
        ok: false,
        error: `Could not send the invite: ${createError?.message ?? "unknown error"}`,
      };
    }
    userId = created.user.id;
  }

  if (req.applicant_id != null) {
    // Resolve the surrogate key from the (induction, applicant_id) pair — the
    // applicant number alone matches records in other cycles belonging to other
    // people.
    const { data: candidate } = await db
      .from("candidates")
      .select("id")
      .eq("applicant_id", req.applicant_id)
      .eq("induction", req.induction)
      .maybeSingle();

    if (!candidate) {
      return {
        ok: false,
        error: `Account created, but no candidate record found for applicant ${req.applicant_id} in induction ${req.induction}.`,
      };
    }

    const { error: linkError } = await db
      .from("candidate_links")
      .upsert(
        { user_id: userId, candidate_id: candidate.id, linked_by: "admin_approval" },
        { onConflict: "candidate_id" }
      );

    if (linkError) {
      return {
        ok: false,
        // Named precisely: the account exists but has no data access, which is a
        // recoverable half-state a staff member needs to recognise.
        error: `Account created but linking to applicant ${req.applicant_id} failed: ${linkError.message}`,
      };
    }
  }

  const { error: updateError } = await db
    .from("access_requests")
    .update({
      status: "approved",
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("email", targetEmail)
    .eq("induction", induction);

  if (updateError) {
    return { ok: false, error: `Approved, but the request status did not save: ${updateError.message}` };
  }

  revalidatePath("/admin");
  return {
    ok: true,
    message: existing
      ? `${targetEmail} already had an account; it is now linked and approved.`
      : `Invite sent to ${targetEmail}. They set their own password from the link.`,
  };
}

/**
 * Reissues a set-password link for an already-approved request.
 *
 * Invite links are single-use and expire. Without this, a candidate whose link
 * expired — or whose mail provider opened it automatically — had no route back
 * in except a staff member deleting their account by hand.
 *
 * Uses recovery rather than invite: the account already exists, and inviting an
 * existing user errors. Recovery produces the same outcome, a link that lets
 * them set a password.
 */
export async function resendAccessLink(
  email: string,
  induction: number
): Promise<ActionResult> {
  const auth = await requireStaff();
  if ("error" in auth) return { ok: false, error: auth.error };

  const db = createAdminClient();

  // Read the address from the stored request, never from the caller, for the
  // same reason as approval: delivery to the address on the candidate record is
  // what establishes identity.
  const { data: req } = await db
    .from("access_requests")
    .select("email, status")
    .eq("email", email)
    .eq("induction", induction)
    .maybeSingle();

  if (!req) return { ok: false, error: "Request not found." };
  if (req.status !== "approved") {
    return { ok: false, error: "Only approved requests can have a link reissued." };
  }

  const { error } = await db.auth.resetPasswordForEmail(req.email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/auth/update-password`,
  });

  if (error) return { ok: false, error: `Could not send the link: ${error.message}` };

  revalidatePath("/admin");
  return { ok: true, message: `A new set-password link has been sent to ${req.email}.` };
}

/**
 * Mints a short-lived signed URL for a payment proof.
 *
 * The bucket is private with no client policies, so this is the only way to see
 * one. A signed URL rather than a permanent link because these objects are bank
 * screenshots — sender name, account number, balance, recent transactions. A
 * link that keeps working is a link that can be forwarded, logged in a referrer
 * header, or left in a browser history.
 *
 * Five minutes is enough to open and read one, and short enough that a leaked
 * URL is worthless by the time it travels.
 */
export async function getPaymentProofUrl(
  email: string,
  induction: number
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const auth = await requireStaff();
  if ("error" in auth) return { ok: false, error: auth.error };

  const db = createAdminClient();

  const { data: req } = await db
    .from("access_requests")
    .select("proof_object_path")
    .eq("email", email)
    .eq("induction", induction)
    .maybeSingle();

  if (!req?.proof_object_path) {
    return { ok: false, error: "No payment proof was uploaded for this request." };
  }

  const { data, error } = await db.storage
    .from("payment-proofs")
    .createSignedUrl(req.proof_object_path, 300);

  if (error || !data?.signedUrl) {
    return { ok: false, error: `Could not open the file: ${error?.message ?? "unknown error"}` };
  }

  // Recorded because viewing a payment proof is access to someone's banking
  // details, and staff access to sensitive records should be attributable.
  await db.from("access_logs").insert({
    email,
    success: true,
    page: "/admin/payment-proof",
  });

  return { ok: true, url: data.signedUrl };
}

export async function rejectAccessRequest(
  email: string,
  induction: number
): Promise<ActionResult> {
  const auth = await requireStaff();
  if ("error" in auth) return { ok: false, error: auth.error };

  const db = createAdminClient();

  const { error } = await db
    .from("access_requests")
    .update({
      status: "rejected",
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("email", email)
    .eq("induction", induction);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  return { ok: true, message: `Request from ${email} rejected.` };
}

export async function markPaymentVerified(
  email: string,
  induction: number,
  verified: boolean
): Promise<ActionResult> {
  const auth = await requireStaff();
  if ("error" in auth) return { ok: false, error: auth.error };

  const db = createAdminClient();
  const { error } = await db
    .from("access_requests")
    .update({ payment_verified: verified })
    .eq("email", email)
    .eq("induction", induction);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  return {
    ok: true,
    message: verified ? `Payment marked verified for ${email}.` : `Payment unmarked for ${email}.`,
  };
}

/** Absolute origin for links in outbound email. */
function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}
