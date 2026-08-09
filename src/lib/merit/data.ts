import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
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
