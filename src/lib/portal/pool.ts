import "server-only";

import { createClient } from "@/lib/supabase/server";
import { CURRENT_INDUCTION } from "@/lib/induction";
import { loadPool, loadPublishedNames } from "./pool-cache";
import {
  buildPoolStats,
  type AppliedIndex,
  type PoolStats,
  type PoolStatsRow,
} from "./pool-stats";

/**
 * The Candidate Pool, for the page of the same name.
 *
 * ## The gate is not optional here
 *
 * Every other portal page reads something as the caller, so RLS decides what
 * comes back and an unverified user simply sees an empty page. This one reads
 * `public.applicants`, which no client role may touch at all — the engine gets
 * at it with the service role, which bypasses every policy.
 *
 * So the check is explicit, and it reuses the existing policy rather than
 * restating it: `seats` is readable only by a verified user, so a read that
 * comes back empty stops the load. Writing the rule out a second time would
 * give it a second place to drift out of agreement with the database.
 *
 * What makes the service-role read safe is not care in this file but that
 * `applicants` carries no name and no contact details. The aggregation in
 * `./pool-stats` then reduces even that to counts, so nothing individual can
 * reach the page whatever a caller asks for.
 */

export type { PoolStats } from "./pool-stats";

export type CandidatePoolView =
  | { ok: true; stats: PoolStats }
  | { ok: false; reason: "unverified" };

export async function loadCandidatePool(
  induction: number = CURRENT_INDUCTION
): Promise<CandidatePoolView> {
  const supabase = await createClient();
  const { data: gate } = await supabase
    .from("seats")
    .select("id")
    .eq("induction", induction)
    .limit(1);

  if (!gate?.length) return { ok: false, reason: "unverified" };

  const [pool, names, appliedIn] = await Promise.all([
    loadPool(induction),
    loadPublishedNames(induction),
    loadAppliedIn(induction),
  ]);

  // The pool and the names are cached and shared with the other portal
  // surfaces, so the only fetch this page adds is the light `applied_in` one.
  return {
    ok: true,
    stats: buildPoolStats(
      pool as unknown as PoolStatsRow[],
      new Set(names.keys()),
      appliedIn
    ),
  };
}

const PAGE = 1000;

/**
 * `applied_in` for every applicant, read as the caller.
 *
 * Two columns and nothing else — no name, no preference list. The original's
 * stats bar counts this field rather than the preference list, and the two
 * genuinely disagree, so matching its numbers means reading it.
 *
 * Paged, because PostgREST caps a response at 1,000 rows and the pool is 3,474:
 * a single request would silently report on the first thousand.
 */
async function loadAppliedIn(induction: number): Promise<AppliedIndex> {
  const supabase = await createClient();
  const out: AppliedIndex = new Map();

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("pool_directory")
      .select("applicant_id, applied_in")
      .eq("induction", induction)
      .order("applicant_id")
      .range(from, from + PAGE - 1);

    if (error || !data?.length) break;

    for (const row of data) {
      const value = row.applied_in;
      const programs =
        value && typeof value === "object" && !Array.isArray(value)
          ? Object.entries(value as Record<string, unknown>)
              .filter(([, applied]) => Boolean(applied))
              .map(([program]) => program)
          : [];
      out.set(row.applicant_id, programs);
    }

    if (data.length < PAGE) break;
  }

  return out;
}
