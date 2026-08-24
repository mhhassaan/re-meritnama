import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CURRENT_INDUCTION } from "@/lib/induction";
import type { InductionPolicy, MeritRow } from "./types";

/**
 * Loads the merit aggregates from disk on the server.
 *
 * Read server-side rather than fetched by the browser, even though these files
 * sit in `public/`. Two reasons: 1,470 rows with per-cycle maps is a large
 * payload to ship to a phone on a Pakistani mobile connection, and filtering
 * and sorting server-side means the client receives only what it renders.
 *
 * Cached for the process lifetime — the pipeline regenerates these between
 * induction rounds, not between requests.
 */

const DATA_DIR = join(process.cwd(), "public", "data");

let meritRowsCache: MeritRow[] | null = null;
let policiesCache: Record<string, InductionPolicy> | null = null;

export async function loadMeritRows(): Promise<MeritRow[]> {
  if (meritRowsCache) return meritRowsCache;

  const raw = await readFile(join(DATA_DIR, "flat_lookup.json"), "utf8");
  const parsed = JSON.parse(raw);
  const rows: MeritRow[] = Array.isArray(parsed)
    ? parsed
    : (Object.values(parsed)[0] as MeritRow[]);

  // The source data carries trailing whitespace on some quota values
  // ("Armed Force "), which would otherwise produce two distinct filter options
  // for the same quota. Spelling is left exactly as published — "Foriegn" is
  // how the PHF portal writes it, and silently correcting it would stop the
  // value matching the official lists candidates are comparing against.
  meritRowsCache = rows.map((r) => ({
    ...r,
    program: r.program?.trim(),
    quota: r.quota?.trim(),
    specialty: r.specialty?.trim(),
    hospital: r.hospital?.trim(),
  }));

  return meritRowsCache;
}

export async function loadPolicies(): Promise<Record<string, InductionPolicy>> {
  if (policiesCache) return policiesCache;

  const raw = await readFile(join(DATA_DIR, "policy_by_induction.json"), "utf8");
  policiesCache = JSON.parse(raw) as Record<string, InductionPolicy>;
  return policiesCache;
}

/**
 * Induction numbers present in the data, ascending.
 *
 * Derived from the rows rather than hardcoded: the set grows every cycle, and a
 * hardcoded list silently drops the newest one.
 */
export async function loadInductions(): Promise<number[]> {
  const rows = await loadMeritRows();
  const seen = new Set<number>();
  for (const row of rows) {
    for (const key of Object.keys(row.yearly_merit ?? {})) seen.add(Number(key));
  }
  return [...seen].sort((a, b) => a - b);
}

/**
 * The cycles present in the data, with the year each one ran and the marks
 * total that applied.
 *
 * The original site labelled these columns "Year" while printing the induction
 * number in them — so its merit table showed a column headed "Year" containing
 * "8", "11", "20". The keys in `flat_lookup.json` are inductions; there is no
 * year in that file at all. The year comes from `policy_by_induction.json`.
 *
 * Both are carried here rather than picking one, because neither alone is
 * enough: a year does not identify a cycle (2021 ran inductions 9 and 10, 2025
 * ran 17, 18 and 19), and an induction number alone is not something a
 * candidate can place in time.
 */
export type Cycle = {
  induction: number;
  /** Calendar year the cycle ran, or null if the policy file does not cover it. */
  year: number | null;
  /**
   * What the UI prints for this cycle — the year, and nothing else.
   *
   * The induction number is kept on the object because it is the actual key
   * into `yearly_merit` and the only stable identity a cycle has, but it is
   * never shown on merit surfaces. That is a deliberate product decision to
   * match the live site, and it means two cycles in the same year render two
   * identically-labelled columns (2025 appears three times). The live site does
   * the same; the columns stay in cycle order, so the left one is the earlier.
   */
  label: string;
  /**
   * Year AND induction, e.g. "2026 (Ind 21)".
   *
   * Used where two cycles from the same year sit side by side and the year
   * alone cannot tell them apart — the cycle cards on Start Here, and the
   * merit-list selector. Merit-table COLUMNS stay year-only, matching the
   * original, because a repeated year in an ordered row is readable and a
   * parenthetical would not fit.
   */
  labelWithInduction: string;
  /** Marks available that cycle — what makes the raw figure interpretable. */
  totalMarks: number | null;
  /** e.g. "2026 (Induction 20 -- Dec 2025/Jan 2026)". */
  policyLabel: string | null;
};

export async function loadCycles(): Promise<Cycle[]> {
  const [inductions, policies] = await Promise.all([
    loadInductions(),
    loadPolicies(),
  ]);

  return inductions.map((induction) => {
    const policy = policies[String(induction)];
    return {
      induction,
      year: policy?.year ?? null,
      label: policy?.year != null ? String(policy.year) : "—",
      labelWithInduction:
        policy?.year != null
          ? `${policy.year} (Ind ${induction})`
          : `Ind ${induction}`,
      totalMarks: policy?.total_marks ?? null,
      policyLabel: policy?.policy_label ?? null,
    };
  });
}

/**
 * Per-cycle summary, for the orientation page's cycle list.
 *
 * `trackedEntries` is the number of seat combinations that actually have a
 * closing merit for that cycle — not the number of rows in the file. A cycle
 * with 0 is one that has not run yet, and showing it as 1,470 would imply data
 * that does not exist.
 */
export type CycleSummary = Cycle & {
  componentsIncluded: number;
  componentsRemoved: number;
  trackedEntries: number;
  /**
   * Mean closing merit that cycle, as % of that cycle's own marks total.
   *
   * Normalised, so the series is comparable across cycles whose totals were 95,
   * 60, 35 and 30. `null` for a cycle with no closing merits yet — plotted as a
   * gap rather than a zero.
   */
  avgPctOfMax: number | null;
  isCurrent: boolean;
};

export async function loadCycleSummaries(): Promise<CycleSummary[]> {
  const [policies, rows] = await Promise.all([loadPolicies(), loadMeritRows()]);

  const counts = new Map<number, number>();
  for (const row of rows) {
    for (const key of Object.keys(row.yearly_merit ?? {})) {
      const induction = Number(key);
      counts.set(induction, (counts.get(induction) ?? 0) + 1);
    }
  }

  // Mean normalised close per cycle, for the trend chart above the cards.
  const totals = new Map<number, { sum: number; count: number }>();
  for (const row of rows) {
    for (const [key, value] of Object.entries(row.yearly_pct_of_max ?? {})) {
      if (typeof value !== "number") continue;
      const induction = Number(key);
      const entry = totals.get(induction) ?? { sum: 0, count: 0 };
      entry.sum += value;
      entry.count += 1;
      totals.set(induction, entry);
    }
  }

  // Driven by the POLICY file, not by `loadCycles`. `loadCycles` derives its
  // list from the cycles that have closing merits, so the cycle now open —
  // which by definition has none yet — would be missing from this list
  // entirely, and the previous one would be labelled as the active formula.
  return Object.values(policies)
    .map((policy) => {
      const components =
        (policy as InductionPolicy & {
          components?: Array<{ included?: boolean }>;
        }).components ?? [];

      return {
        induction: policy.induction_id,
        year: policy.year ?? null,
        label: policy.year != null ? String(policy.year) : "—",
        labelWithInduction:
          policy.year != null
            ? `${policy.year} (Ind ${policy.induction_id})`
            : `Ind ${policy.induction_id}`,
        totalMarks: policy.total_marks ?? null,
        policyLabel: policy.policy_label ?? null,
        componentsIncluded: components.filter((c) => c.included !== false).length,
        componentsRemoved: components.filter((c) => c.included === false).length,
        trackedEntries: counts.get(policy.induction_id) ?? 0,
        avgPctOfMax: (() => {
          const entry = totals.get(policy.induction_id);
          if (!entry?.count) return null;
          return Math.round((entry.sum / entry.count) * 10) / 10;
        })(),
        isCurrent: policy.induction_id === CURRENT_INDUCTION,
      };
    })
    .sort((a, b) => a.induction - b.induction);
}

/** Distinct filter values, each sorted for a stable dropdown order. */
export async function loadFacets() {
  const rows = await loadMeritRows();

  const programs = new Set<string>();
  const quotas = new Set<string>();
  const specialties = new Set<string>();
  const hospitals = new Set<string>();

  for (const row of rows) {
    if (row.program) programs.add(row.program);
    if (row.quota) quotas.add(row.quota);
    if (row.specialty) specialties.add(row.specialty);
    if (row.hospital) hospitals.add(row.hospital);
  }

  const sorted = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b));

  return {
    programs: sorted(programs),
    quotas: sorted(quotas),
    specialties: sorted(specialties),
    hospitals: sorted(hospitals),
  };
}
