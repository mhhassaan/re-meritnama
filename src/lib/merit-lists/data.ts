import "server-only";

import { createClient } from "@/lib/supabase/server";
import { loadPolicies } from "@/lib/merit/data";

/**
 * Candidate-level merit lists, per cycle and round.
 *
 * Every query here runs as the **signed-in user**, through
 * `@/lib/supabase/server` — never the service-role client. That is what makes
 * Row Level Security the thing deciding what comes back, rather than a filter
 * this file remembers to apply. A caller who is not verified gets nothing, and
 * no code here has to check for that.
 *
 * The projection is Tier 1 only. `contact_number` lives on `candidates` and is
 * never selected: the tier split is enforced by the schema, but naming the
 * columns explicitly means a future column added to `merit_entries` cannot
 * silently join the payload either.
 */

const TIER_ONE_COLUMNS =
  "row_no, applicant_id, name_full, pmdc_no, specialty, hospital, program, quota, marks_total, preference_no, consent_status";

export type MeritListEntry = {
  row_no: number | null;
  applicant_id: number;
  name_full: string;
  pmdc_no: string | null;
  specialty: string;
  hospital: string;
  program: string;
  quota: string;
  marks_total: number | null;
  preference_no: number | null;
  consent_status: string | null;
};

export type MeritListCycle = {
  induction: number;
  /** Year only — used where a column header has no room for more. */
  label: string;
  /**
   * Year AND induction, e.g. "2026 (Ind 21)".
   *
   * The merit-table columns stay year-only because the original's do, but a
   * cycle SELECTOR is the one place where two entries reading "2026" is simply
   * ambiguous — and the original writes it out here too.
   */
  labelWithInduction: string;
  rounds: number[];
};

/**
 * Which cycles and rounds actually have data.
 *
 * Derived from the table rather than from the policy file: a cycle with a
 * published formula but no ingested merit list would otherwise appear in the
 * selector and then load nothing.
 */
export async function loadAvailableCycles(): Promise<MeritListCycle[]> {
  const supabase = await createClient();

  // Reads the `merit_list_rounds` view, which does the DISTINCT in the
  // database. Selecting the pairs from `merit_entries` and reducing them here
  // silently loses rounds: PostgREST caps a response at 1000 rows, and ordered
  // by round the first 1000 are all round 1 — so every cycle looked like it had
  // exactly one round. The view is `security_invoker`, so RLS still applies.
  const { data, error } = await supabase
    .from("merit_list_rounds")
    .select("induction, round")
    .order("induction", { ascending: true })
    .order("round", { ascending: true });

  if (error || !data) return [];

  const policies = await loadPolicies();
  const byInduction = new Map<number, Set<number>>();

  // A view's columns are nullable to TypeScript even when the underlying ones
  // are not, so the pair is checked rather than asserted.
  for (const row of data) {
    if (row.induction == null || row.round == null) continue;
    const set = byInduction.get(row.induction) ?? new Set<number>();
    set.add(row.round);
    byInduction.set(row.induction, set);
  }

  return [...byInduction.entries()]
    .map(([induction, rounds]) => {
      const year = policies[String(induction)]?.year;
      const label = year != null ? String(year) : "—";
      return {
        induction,
        label,
        labelWithInduction: `${label} (Ind ${induction})`,
        rounds: [...rounds].sort((a, b) => a - b),
      };
    })
    .sort((a, b) => a.induction - b.induction);
}

export type MeritListQuery = {
  induction: number;
  round: number;
  program?: string;
  quota?: string;
  search?: string;
  /** Optional cap. Omitted, the whole round comes back. */
  limit?: number;
};

export type ConsentBreakdown = {
  total: number;
  accepted: number;
  rejected: number;
  awaited: number;
};

/**
 * Consent totals for a whole round.
 *
 * Counted for the round as published, NOT for the current filter — the summary
 * describes the official list, and a figure that moved every time a programme
 * was selected would be reporting something else entirely.
 */
export async function loadConsentBreakdown(
  induction: number,
  round: number
): Promise<ConsentBreakdown> {
  const supabase = await createClient();

  const countFor = async (status?: string) => {
    let q = supabase
      .from("merit_entries")
      .select("id", { count: "exact", head: true })
      .eq("induction", induction)
      .eq("round", round);
    if (status) q = q.eq("consent_status", status);
    const { count } = await q;
    return count ?? 0;
  };

  const [total, accepted, rejected, awaited] = await Promise.all([
    countFor(),
    countFor("Accepted"),
    countFor("Rejected"),
    countFor("Awaited"),
  ]);

  return { total, accepted, rejected, awaited };
}

/**
 * One round's merit list, in the order PHF published it.
 *
 * Ordered by `row_no`, NOT by marks. The published list is an allocation
 * sequence, not a ranking: row 1 of round 1 carries 23.22 marks while row 976
 * carries 27.17, because the list walks seats and preferences rather than
 * sorting candidates. Re-sorting by marks produced a table that looked
 * plausible and matched nothing — a different person at the top, and figures
 * the official list never shows in that position.
 */
export async function loadMeritList(query: MeritListQuery): Promise<{
  entries: MeritListEntry[];
  total: number;
}> {
  const supabase = await createClient();

  let request = supabase
    .from("merit_entries")
    .select(TIER_ONE_COLUMNS, { count: "exact" })
    .eq("induction", query.induction)
    .eq("round", query.round);

  if (query.program) request = request.eq("program", query.program);
  if (query.quota) request = request.eq("quota", query.quota);

  if (query.search?.trim()) {
    const term = query.search.trim().replace(/[%,()]/g, "");
    // Name, applicant id and PMDC — the three the original made searchable.
    request = request.or(
      `name_full.ilike.%${term}%,pmdc_no.ilike.%${term}%,applicant_id::text.ilike.%${term}%`
    );
  }

  // Each round export is THREE lists concatenated — Accepted, Rejected and
  // Awaited — and each restarts its numbering at 1. Round 1 holds 1,019 / 24 /
  // 10, so `row_no` alone is not unique within a round and ordering by it puts
  // three different people at position 1. Grouping by consent status first
  // restores each published list. Alphabetically that is Accepted, Awaited,
  // Rejected, which puts the main list where a reader expects it.
  // Each round export is THREE lists concatenated — Accepted, Rejected and
  // Awaited — and each restarts its numbering at 1. Round 1 holds 1,019 / 24 /
  // 10, so `row_no` alone is not unique within a round and ordering by it puts
  // three different people at position 1. Grouping by consent status first
  // restores each published list. Alphabetically that is Accepted, Awaited,
  // Rejected, which puts the main list where a reader expects it.
  const ordered = request
    .order("consent_status", { ascending: true, nullsFirst: false })
    .order("row_no", { ascending: true, nullsFirst: false })
    .order("applicant_id", { ascending: true });

  // Paged, not capped.
  //
  // This used to take the first 500 rows and say so in the footer. Round 8 has
  // 1,208 entries, so that footer was admitting to hiding 59% of the list —
  // and a merit list that stops before your name is worse than no merit list,
  // because you conclude you are not on it. PostgREST caps a single response at
  // 1000 rows, so the only way to show all of them is to ask more than once.
  const PAGE = 1000;
  const entries: MeritListEntry[] = [];
  let total = 0;

  for (let from = 0; ; from += PAGE) {
    const { data, error, count } = await ordered.range(from, from + PAGE - 1);

    if (error) {
      // An RLS denial is not an exception — it is an empty result.
      // Distinguishing "you may not see this" from "this does not exist" would
      // leak the difference, the same reason storage denials read as not-found.
      return { entries: [], total: 0 };
    }

    if (count != null) total = count;
    if (!data?.length) break;

    entries.push(...(data as MeritListEntry[]));

    if (data.length < PAGE) break;
    // A caller that asked for a bounded slice still gets one.
    if (query.limit && entries.length >= query.limit) break;
  }

  return {
    entries: query.limit ? entries.slice(0, query.limit) : entries,
    total,
  };
}

/**
 * Filter options, scoped to the round being viewed.
 *
 * Also reads the view rather than the table, for the same reason: round 1 alone
 * holds 1,053 entries, so collecting distinct values from the rows would hit
 * the 1000-row cap and silently drop whichever programme or quota sorted last.
 */
export async function loadListFacets(induction: number, round: number) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("merit_list_rounds")
    .select("program, quota")
    .eq("induction", induction)
    .eq("round", round);

  const programs = new Set<string>();
  const quotas = new Set<string>();

  for (const row of data ?? []) {
    if (row.program) programs.add(row.program);
    if (row.quota) quotas.add(row.quota);
  }

  const sorted = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b));
  return { programs: sorted(programs), quotas: sorted(quotas) };
}
