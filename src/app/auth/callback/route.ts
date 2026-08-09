import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for every emailed auth link: confirmation, invite, magic link
 * and password recovery.
 *
 * This is the mechanism that actually proves identity in this product. Email and
 * applicant id are both published, so neither proves anything on their own —
 * what proves the claim is that the link arrived at the address already on the
 * candidate record. Everything else is a plausibility check.
 *
 * Supabase sends two link shapes depending on project age and template:
 *   - `?token_hash=...&type=...`  verified with verifyOtp
 *   - `?code=...`                 exchanged with exchangeCodeForSession (PKCE)
 * Both are handled so a template change does not silently break sign-in.
 */

/** Only same-origin relative paths, so a crafted link cannot redirect offsite. */
function safeNext(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  // Recovery and invite both mean "you have not set a password yet, or want a
  // new one", so they land on the set-password screen rather than the portal.
  const isPasswordFlow = type === "recovery" || type === "invite";
  const fallback = isPasswordFlow ? "/auth/update-password" : "/app";
  const next = safeNext(searchParams.get("next"), fallback);

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(
      `${origin}/auth?error=${encodeURIComponent(linkErrorMessage(error.message))}`
    );
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(
      `${origin}/auth?error=${encodeURIComponent(linkErrorMessage(error.message))}`
    );
  }

  return NextResponse.redirect(
    `${origin}/auth?error=${encodeURIComponent("That link is missing its verification token.")}`
  );
}

/**
 * Expired and already-used links are the overwhelmingly common failure and have
 * a clear remedy, so they get their own message instead of raw SDK text.
 */
function linkErrorMessage(raw: string): string {
  const lowered = raw.toLowerCase();
  if (lowered.includes("expired") || lowered.includes("invalid")) {
    return "That link has expired or has already been used. Request a new one.";
  }
  return "We could not verify that link. Please request a new one.";
}
