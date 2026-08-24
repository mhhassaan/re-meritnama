import "server-only";

import { CURRENT_INDUCTION } from "@/lib/induction";
import { loadSeats } from "./data";

/**
 * The Hospital Directory and the per-hospital profile.
 *
 * Both are derived entirely from `seats` — the same 873 rows every other portal
 * page reads, already cached and shared. No new table, no ingest: a hospital in
 * this product is not an entity with its own record, it is whatever the seat
 * matrix says trains there.
 *
 * `seats` carries no personal data, so this is read as the caller under the
 * ordinary verified-user policy.
 *
 * ## What the original has here that this does not
 *
 * Its profile page ends with **Training Reviews** — user-written reviews with
 * an overall rating and per-aspect scores. That is a community feature with a
 * table, a write path, and a moderation problem, not a view over seat data, so
 * it is listed as unbuilt rather than quietly dropped.
 */

export type HospitalSummary = {
  slug: string;
  name: string;
  institute: string | null;
  seats: number;
  specialties: string[];
  programs: string[];
  /**
   * Seats per programme, largest first.
   *
   * The card draws this as a proportional bar. "FCPS, MS, MD" as a list of
   * names says a hospital trains three programmes; the bar says whether it is
   * mostly one of them, which is the thing that decides whether a preference
   * there is worth spending.
   */
  seatsByProgram: Array<{ program: string; seats: number }>;
};

export type HospitalProfile = {
  slug: string;
  name: string;
  institute: string | null;
  seats: number;
  /** Programmes present at this hospital, in the portal's own order. */
  programs: string[];
  /**
   * One row per specialty: seats per programme plus the total.
   *
   * Columns come from the programmes this hospital actually trains, not a fixed
   * FCPS/MS/MD triple. The original hardcodes those three, which leaves a
   * dental institute showing three empty columns and no dentistry.
   */
  rows: Array<{
    specialty: string;
    byProgram: Record<string, number>;
    total: number;
  }>;
  quotas: Array<{ quota: string; seats: number }>;
};

/** The portal's own programme order, with anything unexpected falling to the end. */
const PROGRAM_ORDER = ["FCPS", "MS", "MD", "FCPS Dentistry", "MDS"];

function byProgramOrder(a: string, b: string): number {
  const ai = PROGRAM_ORDER.indexOf(a);
  const bi = PROGRAM_ORDER.indexOf(b);
  if (ai !== -1 && bi !== -1) return ai - bi;
  if (ai !== -1) return -1;
  if (bi !== -1) return 1;
  return a.localeCompare(b);
}

/**
 * A URL-safe id for a hospital.
 *
 * The original addresses hospitals by a numeric portal id — `hospital.html?id=3`
 * — which is not a column we hold; our seat rows key on the name. A slug of the
 * name is stable for as long as the name is, and it survives being pasted into
 * a message, which an opaque integer does not.
 */
export function hospitalSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type Grouped = {
  name: string;
  institute: string | null;
  seats: number;
  bySpecialty: Map<string, Map<string, number>>;
  byQuota: Map<string, number>;
  byProgram: Map<string, number>;
  programs: Set<string>;
};

async function group(induction: number): Promise<Map<string, Grouped>> {
  const rows = await loadSeats(induction);
  const out = new Map<string, Grouped>();

  for (const row of rows) {
    const name = row.hospital.trim();
    if (!name) continue;

    const slug = hospitalSlug(name);
    const found = out.get(slug) ?? {
      name,
      institute: row.institute?.trim() || null,
      seats: 0,
      bySpecialty: new Map<string, Map<string, number>>(),
      byQuota: new Map<string, number>(),
      byProgram: new Map<string, number>(),
      programs: new Set<string>(),
    };

    const program = row.program.trim();
    const specialty = row.specialty.trim();
    const quota = row.quota.trim();

    found.seats += row.seats;
    found.programs.add(program);

    const specialtyRow = found.bySpecialty.get(specialty) ?? new Map<string, number>();
    specialtyRow.set(program, (specialtyRow.get(program) ?? 0) + row.seats);
    found.bySpecialty.set(specialty, specialtyRow);

    found.byQuota.set(quota, (found.byQuota.get(quota) ?? 0) + row.seats);
    found.byProgram.set(program, (found.byProgram.get(program) ?? 0) + row.seats);

    out.set(slug, found);
  }

  return out;
}

export async function loadHospitals(
  induction: number = CURRENT_INDUCTION
): Promise<HospitalSummary[]> {
  const grouped = await group(induction);

  return [...grouped.entries()]
    .map(([slug, h]) => ({
      slug,
      name: h.name,
      institute: h.institute,
      seats: h.seats,
      specialties: [...h.bySpecialty.keys()].sort((a, b) => a.localeCompare(b)),
      programs: [...h.programs].sort(byProgramOrder),
      seatsByProgram: [...h.byProgram.entries()]
        .map(([program, seats]) => ({ program, seats }))
        .sort((a, b) => b.seats - a.seats || byProgramOrder(a.program, b.program)),
    }))
    // Biggest first: a directory of 69 is scanned, and the hospitals with the
    // most seats are the ones most people are choosing between.
    .sort((a, b) => b.seats - a.seats || a.name.localeCompare(b.name));
}

export async function loadHospital(
  slug: string,
  induction: number = CURRENT_INDUCTION
): Promise<HospitalProfile | null> {
  const grouped = await group(induction);
  const found = grouped.get(slug);
  if (!found) return null;

  const programs = [...found.programs].sort(byProgramOrder);

  const rows = [...found.bySpecialty.entries()]
    .map(([specialty, perProgram]) => {
      const byProgram: Record<string, number> = {};
      let total = 0;
      for (const program of programs) {
        const seats = perProgram.get(program) ?? 0;
        byProgram[program] = seats;
        total += seats;
      }
      return { specialty, byProgram, total };
    })
    .sort((a, b) => b.total - a.total || a.specialty.localeCompare(b.specialty));

  return {
    slug,
    name: found.name,
    institute: found.institute,
    seats: found.seats,
    programs,
    rows,
    quotas: [...found.byQuota.entries()]
      .map(([quota, seats]) => ({ quota, seats }))
      .sort((a, b) => b.seats - a.seats || a.quota.localeCompare(b.quota)),
  };
}
