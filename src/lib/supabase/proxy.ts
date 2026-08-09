import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";

/**
 * Refreshes the Supabase auth session on every matched request.
 *
 * Access tokens are short-lived. Without a refresh on the server, a Server
 * Component would see an expired token and treat a signed-in user as anonymous.
 * This reads the session, refreshes it if needed, and writes the rotated
 * cookies onto the response.
 *
 * Deliberately NOT an authorization layer. The Next.js docs are explicit that
 * Proxy is for optimistic checks only, and it runs before the request reaches
 * the route — so a redirect here is a UX affordance, not a security control.
 * Real enforcement lives in two places that cannot be bypassed:
 *   1. Row Level Security in Postgres
 *   2. a getUser() check inside the protected layout/route itself
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          // The response must be rebuilt from the mutated request so the
          // refreshed cookies reach both the route handler and the browser.
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // getUser() revalidates the token against the auth server. Never substitute
  // getSession() here — that decodes the cookie without verifying it, so its
  // contents are attacker-controllable.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
