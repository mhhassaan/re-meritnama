import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CURRENT_INDUCTION } from "@/lib/induction";
import { loadMeritRows } from "@/lib/merit/data";
import type { CalculatorPolicy, PolicyComponent } from "./types";

/**
 * The scoring formula for a cycle.
 *
 * Read from `policy_by_induction.json`, the same file the merit table gets its
 * years from — the components live there alongside the totals, so the
 * calculator needs no data source of its own.
 */

const DATA_DIR = join(process.cwd(), "public", "data");

let cache: Record<number, CalculatorPolicy> = {};

type RawPolicy = {
  induction_id: number;
  year: number;
  label: string;
  policy_ref?: string;
  total_marks: number;
  notes?: string;
  tidbits?: string[];
  components?: PolicyComponent[];
};

export async function loadCalculatorPolicy(
  induction: number = CURRENT_INDUCTION
): Promise<CalculatorPolicy | null> {
  if (cache[induction]) return cache[induction];

  const raw = await readFile(join(DATA_DIR, "policy_by_induction.json"), "utf8");
  const parsed = JSON.parse(raw) as Record<string, RawPolicy>;
  const policy = parsed[String(induction)];
  if (!policy?.components) return null;

  cache = {
    ...cache,
    [induction]: {
      induction: policy.induction_id,
      year: policy.year,
      label: policy.label,
      totalMarks: policy.total_marks,
      notes: policy.notes ?? null,
      policyRef: policy.policy_ref ?? null,
      tidbits: policy.tidbits ?? [],
      components: policy.components,
    },
  };

  return cache[induction];
}

/**
 * Every closing merit on record, as a percentage of its own cycle's total.
 *
 * This is the distribution a calculated score is ranked against. Normalised
 * values only — ranking a 30-mark score against a mixture of 95-mark and
 * 30-mark raw figures would be meaningless.
 */
export async function loadMeritDistribution(): Promise<number[]> {
  const rows = await loadMeritRows();
  return rows
    .map((row) => row.avg_pct_of_max)
    .filter((v): v is number => typeof v === "number");
}
