import "server-only";

import { CURRENT_INDUCTION } from "@/lib/induction";
import { loadPool } from "./pool-cache";
import { loadSeats } from "./data";

/**
 * Competition & Demand Index.
 *
 * The original's framing: "See how many candidates applied per seat for each
 * specialty. Higher ratios mean tougher competition." One row per
 * (programme, quota, specialty) — aggregated across every hospital, because
 * the question is "how hard is Cardiology under Punjab quota", not "how hard
 * is Cardiology at one particular hospital".
 *
 * ## No new fetch, and the algorithm is the original's
 *
 * Both inputs — `loadPool` (service role, cached) and `loadSeats` (as the
 * caller, cached) — are already loaded by every other portal page. This
 * costs nothing extra. The grouping is read straight out of the deployed
 * site's own `buildCompetitionData`, applicant counting included: a
 * candidate who lists three hospitals under the same (programme, quota,
 * specialty) counts **once**, not three times, or a person's own breadth of
 * choice would be mistaken for extra demand.
 *
 * "Applicants" here is therefore a different, smaller number from the
 * 180,784 raw preference rows: it is deduplicated people, not preference
 * entries.
 *
 * ## The whole pool, never the status scope
 *
 * The live page reads `SIM.candidates` directly — all 3,474 — with no
 * verification filter, confirmed against the deployed site
 * (`SIM.candidates.length` is 3,474 while the default status scope holds
 * 3,289). Demand is a fact about who **applied**, not about who cleared
 * verification, so the Config tab's scope does not reach this page, and it
 * should not.
 */

export type CompetitionSort = "ratio-desc" | "ratio-asc" | "specialty" | "applicants-desc";

export type DemandTier = "safe" | "reach" | "danger";

export type CompetitionRow = {
  specialty: string;
  program: string;
  quota: string;
  seats: number;
  applicants: number;
  /** `Infinity` when seats is 0 and at least one person still listed it. */
  ratio: number;
  tier: DemandTier;
  /** 0–100, scaled against the highest finite ratio in the current filter. */
  barWidth: number;
};

export type CompetitionFilters = {
  program?: string;
  quota?: string;
  search?: string;
  sort?: CompetitionSort;
};

export type CompetitionView = {
  rows: CompetitionRow[];
  /** Rows matching the filter, before any cap — there is none, see below. */
  matched: number;
  /** Rows before filtering. */
  total: number;
  totalSeats: number;
  totalApplicants: number;
  /** Weighted: total applicants over total seats, not the mean of the ratios. */
  averageRatio: number | null;
  facets: { programs: string[]; quotas: string[] };
};

const t = (v: string | null | undefined) => (v ?? "").trim();

/** `ratio > 10` red, `> 5` gold, else green — the deployed site's own cutoffs. */
function tierOf(ratio: number): DemandTier {
  if (ratio > 10) return "danger";
  if (ratio > 5) return "reach";
  return "safe";
}

export async function loadCompetition(
  filters: CompetitionFilters = {},
  induction: number = CURRENT_INDUCTION
): Promise<CompetitionView> {
  const [pool, seats] = await Promise.all([loadPool(induction), loadSeats(induction)]);

  const key = (program: string, quota: string, specialty: string) =>
    `${t(program)}|${t(quota)}|${t(specialty)}`;

  // ── Seats per combination, across every hospital ─────────────────────────
  const seatsByKey = new Map<string, number>();
  for (const row of seats) {
    const k = key(row.program, row.quota, row.specialty);
    seatsByKey.set(k, (seatsByKey.get(k) ?? 0) + row.seats);
  }

  // ── Applicants per combination, deduplicated per candidate ───────────────
  const applicantsByKey = new Map<string, number>();
  for (const applicant of pool) {
    const seen = new Set<string>();
    for (const preference of applicant.preferences ?? []) {
      const k = key(preference.program, preference.quota, preference.specialty);
      if (seen.has(k)) continue;
      seen.add(k);
      applicantsByKey.set(k, (applicantsByKey.get(k) ?? 0) + 1);
    }
  }

  // A combination exists if it has seats OR applicants — a seat nobody
  // applied for is real news, and a specialty people want with no seat this
  // cycle is the more alarming version of the same fact.
  const allKeys = new Set([...seatsByKey.keys(), ...applicantsByKey.keys()]);

  const all = [...allKeys].map((k) => {
    const [program, quota, specialty] = k.split("|");
    const rowSeats = seatsByKey.get(k) ?? 0;
    const applicants = applicantsByKey.get(k) ?? 0;
    const ratio = rowSeats > 0 ? applicants / rowSeats : applicants > 0 ? Infinity : 0;
    return { specialty, program, quota, seats: rowSeats, applicants, ratio };
  });

  const facets = {
    programs: unique(all.map((r) => r.program)),
    quotas: unique(all.map((r) => r.quota)),
  };

  // ── Filter ────────────────────────────────────────────────────────────
  const term = filters.search?.trim().toLowerCase();
  const filtered = all.filter((r) => {
    if (filters.program && r.program !== filters.program) return false;
    if (filters.quota && r.quota !== filters.quota) return false;
    if (term && !r.specialty.toLowerCase().includes(term)) return false;
    return true;
  });

  // ── Sort ──────────────────────────────────────────────────────────────
  const sort = filters.sort ?? "ratio-desc";
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "ratio-asc") return a.ratio - b.ratio;
    if (sort === "specialty") return a.specialty.localeCompare(b.specialty);
    if (sort === "applicants-desc") return b.applicants - a.applicants;
    return b.ratio - a.ratio; // ratio-desc, the default
  });

  // ── Totals, over the filtered set ────────────────────────────────────
  const totalSeats = filtered.reduce((sum, r) => sum + r.seats, 0);
  const totalApplicants = filtered.reduce((sum, r) => sum + r.applicants, 0);
  const averageRatio = totalSeats > 0 ? totalApplicants / totalSeats : null;

  const finiteRatios = filtered.map((r) => r.ratio).filter((r) => Number.isFinite(r));
  const maxRatio = finiteRatios.length ? Math.max(...finiteRatios) : 1;

  // The original caps the table at 150 rows to keep a client-side render
  // smooth. There is no such cost here: the whole matched set tops out
  // around 160 rows of plain text, server-rendered once, so nothing is cut.
  const rows: CompetitionRow[] = sorted.map((r) => ({
    specialty: r.specialty,
    program: r.program,
    quota: r.quota,
    seats: r.seats,
    applicants: r.applicants,
    ratio: r.ratio,
    tier: tierOf(r.ratio),
    barWidth:
      maxRatio > 0
        ? Math.min(100, (Number.isFinite(r.ratio) ? r.ratio : maxRatio) / maxRatio * 100)
        : 0,
  }));

  return {
    rows,
    matched: filtered.length,
    total: all.length,
    totalSeats,
    totalApplicants,
    averageRatio,
    facets,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
