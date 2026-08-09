import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CURRENT_INDUCTION } from "@/lib/induction";

/**
 * Payment proof upload.
 *
 * Submitted by someone who has requested access but has no account yet, so
 * there is no authenticated identity to key a storage policy on. The upload
 * therefore goes through this route with the service role, and the bucket has
 * no client policies at all.
 *
 * A bank transfer screenshot is the most financially exposing object in the
 * product — sender name, account number, balance, recent transactions. Three
 * consequences, all enforced here rather than trusted to the browser:
 *
 *   1. It is only accepted for an email that already has a pending request.
 *      Otherwise this is an anonymous file-upload endpoint pointed at storage.
 *   2. The file is validated server-side. Client-side checks are a convenience;
 *      the request can be made directly.
 *   3. Nothing is ever returned to the uploader. The stored path goes to the
 *      request row for staff to review via a short-lived signed URL.
 */

const MAX_BYTES = 5 * 1024 * 1024;

/** Kept in step with the bucket's allowed_mime_types. */
const ALLOWED = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["application/pdf", "pdf"],
]);

/**
 * Magic bytes, checked because the declared Content-Type is attacker-chosen.
 * Stops an executable or script being stored under an image label.
 */
function sniff(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  ) return "image/png";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  if (
    bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
  ) return "application/pdf";
  return null;
}

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Malformed upload." }, { status: 400 });
  }

  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const message = String(form.get("message") ?? "").trim().slice(0, 2000);
  const reference = String(form.get("reference") ?? "").trim().slice(0, 120);
  const file = form.get("file");

  if (!email) {
    return NextResponse.json(
      { error: "Enter the email you used for your access request." },
      { status: 400 }
    );
  }

  const db = createAdminClient();

  // Only accept a proof for a request that exists. Without this the endpoint is
  // an anonymous uploader pointed at storage.
  const { data: existingRequest } = await db
    .from("access_requests")
    .select("id, email, status")
    .eq("email", email)
    .eq("induction", CURRENT_INDUCTION)
    .maybeSingle();

  if (!existingRequest) {
    // Same wording whether the address is unknown or simply has no request, so
    // the endpoint cannot be used to discover who has applied.
    return NextResponse.json(
      {
        error:
          "We could not find an access request for that email. Submit the " +
          "Request tab first, then send your payment proof.",
      },
      { status: 404 }
    );
  }

  let objectPath: string | null = null;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "That file is larger than 5 MB. Please send a smaller screenshot." },
        { status: 413 }
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const sniffed = sniff(bytes);

    if (!sniffed || !ALLOWED.has(sniffed)) {
      return NextResponse.json(
        { error: "Only JPG, PNG, WebP or PDF files are accepted." },
        { status: 415 }
      );
    }

    // The path is derived, never taken from the upload: a client-supplied
    // filename can traverse directories or overwrite another person's proof.
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeEmail = email.replace(/[^a-z0-9]+/g, "_");
    objectPath = `${CURRENT_INDUCTION}/${safeEmail}/${stamp}.${ALLOWED.get(sniffed)}`;

    const { error: uploadError } = await db.storage
      .from("payment-proofs")
      .upload(objectPath, bytes, {
        contentType: sniffed, // the sniffed type, not the declared one
        upsert: false,        // keep every submission; never overwrite evidence
      });

    if (uploadError) {
      console.error("payment proof upload failed:", uploadError.message);
      return NextResponse.json(
        { error: "Could not store your file. Please try again." },
        { status: 500 }
      );
    }
  }

  if (!objectPath && !message && !reference) {
    return NextResponse.json(
      { error: "Attach a screenshot, or include a transaction reference or message." },
      { status: 400 }
    );
  }

  const { error: updateError } = await db
    .from("access_requests")
    .update({
      payment_declared: true,
      // Only overwrite when something new was supplied, so a later message does
      // not wipe an earlier screenshot.
      ...(objectPath ? { proof_object_path: objectPath } : {}),
      ...(reference ? { payment_reference: reference } : {}),
      ...(message ? { message } : {}),
    })
    .eq("id", existingRequest.id);

  if (updateError) {
    console.error("payment proof record failed:", updateError.message);
    return NextResponse.json(
      { error: "Your file was stored but the request could not be updated." },
      { status: 500 }
    );
  }

  // Deliberately returns no path, URL or filename: the uploader has no account
  // and no reason to be handed a reference to stored evidence.
  return NextResponse.json({
    ok: true,
    message:
      "Payment proof received. Your request will be reviewed and you will get " +
      "an email once access is approved.",
  });
}
