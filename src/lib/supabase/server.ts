import "server-only";

/**
 * Supabase client for Server Components, Route Handlers and Server Actions.
 *
 * Still uses the publishable key and still runs as the signed-in user, so RLS
 * applies exactly as it does in the browser. The difference is only where the
 * session comes from: cookies rather than local storage.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies. This is expected and safe
            // to ignore as long as middleware refreshes the session, which it
            // does — see src/proxy.ts.
          }
        },
      },
    }
  );
}

/**
 * Returns the signed-in user, or null.
 *
 * Always use this rather than reading the session from cookies directly.
 * getClaims()/getUser() verify the token with the auth server; a session object
 * decoded straight from a cookie is attacker-controllable and must never be
 * trusted for an authorization decision.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) return null;
  return user;
}
