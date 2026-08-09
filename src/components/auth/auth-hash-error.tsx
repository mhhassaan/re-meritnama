"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";

/**
 * Surfaces auth errors that arrive in the URL fragment.
 *
 * When Supabase rejects an emailed link it redirects back with the reason after
 * a `#`, e.g. `#error=access_denied&error_code=otp_expired`. Fragments are never
 * sent to the server, so the callback route cannot see them and reports only
 * that no token arrived — which hides the real cause. This reads the fragment on
 * the client and shows what actually happened.
 *
 * The fragment is then cleared from the address bar so a refresh does not
 * re-display a stale error.
 */
const FRIENDLY: Record<string, string> = {
  otp_expired:
    "That link has already been used or has expired. Email links work once, and some email providers open links automatically to scan them — which uses the link up before you click it. Request a new one below.",
  access_denied:
    "That link was rejected. It may have already been used, or it was issued for a different address.",
};

export function AuthHashError() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!window.location.hash) return;

    const params = new URLSearchParams(window.location.hash.slice(1));
    const code = params.get("error_code");
    const error = params.get("error");
    if (!code && !error) return;

    const description = params.get("error_description")?.replace(/\+/g, " ");
    setMessage(
      (code && FRIENDLY[code]) ||
        (error && FRIENDLY[error]) ||
        description ||
        "That link could not be verified. Please request a new one."
    );

    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search
    );
  }, []);

  if (!message) return null;

  return (
    <div className="mx-auto mb-4 flex max-w-md items-start gap-2 rounded-sm border border-status-danger bg-status-danger-quiet p-3 text-xs font-medium text-status-danger">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
