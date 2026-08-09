import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/types";

export type AppRole = Enums<"app_role">;

const STAFF_ROLES: AppRole[] = ["super_admin", "moderator"];

/**
 * Reads the caller's role from `user_roles`.
 *
 * Runs as the signed-in user, so the row is returned only because the RLS
 * policy allows reading your own. That is deliberate: the same policy the
 * database uses to authorise data access is the one answering here, rather than
 * a second, parallel notion of "who is an admin" that could drift out of sync
 * with it.
 *
 * Returns null for signed-out users and for users with no role.
 */
export async function getCurrentRole(): Promise<AppRole | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  return data?.role ?? null;
}

export function isStaffRole(role: AppRole | null): boolean {
  return role !== null && STAFF_ROLES.includes(role);
}
