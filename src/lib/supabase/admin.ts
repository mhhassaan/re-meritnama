import "server-only";

/**
 * Supabase client using the service_role key.
 *
 * This key BYPASSES Row Level Security completely. Every policy in the database
 * is inert for this client — it can read every candidate's CNIC and delete any
 * table. Treat it the way you would a database superuser password.
 *
 * `import "server-only"` above turns an accidental client import into a build
 * error rather than a runtime key leak.
 *
 * Legitimate uses are narrow:
 *   - the ingest pipeline writing candidates and merit_entries
 *   - verifying an access request against the private candidates table
 *   - creating candidate_links after a claim is verified
 *   - granting roles in user_roles
 *
 * If a feature seems to need this client, check first whether it actually needs
 * a policy. Reaching for service_role to make a permission error go away is how
 * access control quietly disappears.
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL must both be set " +
        "to use the admin client."
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      // No session handling: this client is not a user and must never pick up
      // or persist one. Refreshing a token here could attach service_role
      // privileges to a real user's session.
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
