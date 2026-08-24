import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { CURRENT_INDUCTION } from "@/lib/induction";

/**
 * How many applicants are in the cycle's pool.
 *
 * A count, not rows. `public.applicants` has no client grant and no select
 * policy — 3,474 preference lists is the shape of the original's leak — so this
 * goes through the service role. What crosses the boundary is a single integer,
 * which is also what the live portal shows in its header.
 *
 * Separate from `runAllocation` deliberately: the Overview needs the number and
 * nothing else, and loading the whole pool to count it would make an
 * explanatory page as expensive as a simulation.
 */
export async function loadPoolSize(
  induction: number = CURRENT_INDUCTION
): Promise<number> {
  const admin = createAdminClient();

  const { count, error } = await admin
    .from("applicants")
    .select("id", { count: "exact", head: true })
    .eq("induction", induction);

  if (error) return 0;
  return count ?? 0;
}
