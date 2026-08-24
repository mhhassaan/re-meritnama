import "server-only";

import { createClient } from "@/lib/supabase/server";
import { CURRENT_INDUCTION } from "@/lib/induction";
import { FINAL_ROUND } from "@/lib/portal/rounds";

/**
 * Joining Status — who actually reported to the seat they were allocated.
 *
 * The last question of a cycle, and the only one the merit list cannot answer.
 * Round 8 placed people into 742 seats; the final seat-allocation export covers
 * 1,082 candidates across 679 of them. The gap is what makes a seat genuinely
 * free rather than merely listed.
 *
 * Read **as the caller** from `joining_status`, which is gated on
 * `private.is_verified()`. Placements are already Tier 1 — `merit_entries`
 * publishes who was allocated each seat — and whether that person turned up is
 * the same category of fact about the same public allocation.
 */

const PAGE = 1000;

export type JoiningPerson = {
  applicantId: number;
  name: string | null;
  marks: number | null;
  preferenceNo: number | null;
  joined: boolean;
  /**
   * For someone who joined, the day they did. For someone still pending, the
   * day by which they had to — the export uses one field for both, and the
   * page labels it accordingly rather than printing a joining date for a person
   * who has not joined.
   */
  date: string | null;
};

export type JoiningSlot = {
  program: string;
  specialty: string;
  hospital: string;
  quota: string;
  seats: number | null;
  people: JoiningPerson[];
  joined: number;
};

/** A seat that had people in the final merit round and nobody in the export. */
export type EmptySlot = {
  program: string;
  specialty: string;
  hospital: string;
  quota: string;
  /** How many the final round placed there. */
  placed: number;
};

export type JoiningView = {
  ok: boolean;
  summary: {
    tracked: number;
    joined: number;
    notJoined: number;
    slots: number;
    emptySlots: number;
    /** People the final round placed into slots nobody appears in. */
    strandedPlacements: number;
  };
  slots: JoiningSlot[];
  empty: EmptySlot[];
  facets: {
    programs: string[];
    specialties: string[];
    hospitals: string[];
    quotas: string[];
  };
  /** Slots before filtering, so the count can say "N of M". */
  totalSlots: number;
};

export type JoiningFilters = {
  program?: string;
  specialty?: string;
  hospital?: string;
  quota?: string;
  search?: string;
  /** "joined" or "pending"; anything else means all. */
  status?: string;
};

const t = (v: string | null | undefined) => (v ?? "").trim();
const keyOf = (program: string, specialty: string, hospital: string, quota: string) =>
  `${t(program)}|${t(specialty)}|${t(hospital)}|${t(quota)}`;

type Row = {
  applicant_id: number;
  name_full: string | null;
  marks: number | null;
  preference_no: number | null;
  program: string;
  specialty: string;
  hospital: string;
  quota: string;
  seats: number | null;
  status: string;
  joined_on: string | null;
};

export async function loadJoining(
  filters: JoiningFilters = {},
  induction: number = CURRENT_INDUCTION
): Promise<JoiningView> {
  const supabase = await createClient();

  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("joining_status")
      .select(
        "applicant_id, name_full, marks, preference_no, program, specialty, hospital, quota, seats, status, joined_on"
      )
      .eq("induction", induction)
      .order("applicant_id")
      .range(from, from + PAGE - 1);

    // An RLS denial is an empty result, not an exception.
    if (error || !data?.length) break;
    rows.push(...(data as Row[]));
    if (data.length < PAGE) break;
  }

  if (rows.length === 0) {
    return {
      ok: false,
      summary: {
        tracked: 0,
        joined: 0,
        notJoined: 0,
        slots: 0,
        emptySlots: 0,
        strandedPlacements: 0,
      },
      slots: [],
      empty: [],
      facets: { programs: [], specialties: [], hospitals: [], quotas: [] },
      totalSlots: 0,
    };
  }

  // ── Group into seats ────────────────────────────────────────────────────
  const grouped = new Map<string, JoiningSlot>();

  for (const row of rows) {
    const key = keyOf(row.program, row.specialty, row.hospital, row.quota);
    const slot = grouped.get(key) ?? {
      program: t(row.program),
      specialty: t(row.specialty),
      hospital: t(row.hospital),
      quota: t(row.quota),
      seats: row.seats,
      people: [],
      joined: 0,
    };

    const joined = row.status === "Joined";
    slot.people.push({
      applicantId: row.applicant_id,
      name: row.name_full,
      marks: row.marks != null ? Number(row.marks) : null,
      preferenceNo: row.preference_no,
      joined,
      date: row.joined_on,
    });
    if (joined) slot.joined += 1;

    grouped.set(key, slot);
  }

  const allSlots = [...grouped.values()].map((slot) => ({
    ...slot,
    // Joined first, then by mark — the people holding the seat belong at the
    // top, the same ordering the merit-list card uses.
    people: slot.people.sort(
      (a, b) => Number(b.joined) - Number(a.joined) || (b.marks ?? 0) - (a.marks ?? 0)
    ),
  }));

  allSlots.sort(
    (a, b) =>
      a.specialty.localeCompare(b.specialty) ||
      a.hospital.localeCompare(b.hospital) ||
      a.quota.localeCompare(b.quota)
  );

  // ── Seats the final round filled and the export does not mention ────────
  //
  // Not "unjoined": nobody appears against them at all, which means the seat
  // was vacated outright rather than allocated to someone who then failed to
  // turn up. The distinction matters, because one of those seats is free and
  // the other may not be.
  const empty: EmptySlot[] = [];
  const finalRound = new Map<string, { row: Row2; count: number }>();

  type Row2 = { program: string; specialty: string; hospital: string; quota: string };

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("merit_entries")
      .select("program, specialty, hospital, quota")
      .eq("induction", induction)
      .eq("round", FINAL_ROUND)
      .range(from, from + PAGE - 1);

    if (error || !data?.length) break;
    for (const entry of data as Row2[]) {
      const key = keyOf(entry.program, entry.specialty, entry.hospital, entry.quota);
      const found = finalRound.get(key);
      if (found) found.count += 1;
      else finalRound.set(key, { row: entry, count: 1 });
    }
    if (data.length < PAGE) break;
  }

  for (const [key, { row, count }] of finalRound) {
    if (grouped.has(key)) continue;
    empty.push({
      program: t(row.program),
      specialty: t(row.specialty),
      hospital: t(row.hospital),
      quota: t(row.quota),
      placed: count,
    });
  }

  empty.sort(
    (a, b) =>
      b.placed - a.placed ||
      a.specialty.localeCompare(b.specialty) ||
      a.hospital.localeCompare(b.hospital)
  );

  // ── Summary, over the whole export rather than the filter ───────────────
  const summary = {
    tracked: rows.length,
    joined: rows.filter((r) => r.status === "Joined").length,
    notJoined: rows.filter((r) => r.status !== "Joined").length,
    slots: allSlots.length,
    emptySlots: empty.length,
    strandedPlacements: empty.reduce((sum, e) => sum + e.placed, 0),
  };

  const facets = {
    programs: unique(allSlots.map((s) => s.program)),
    specialties: unique(allSlots.map((s) => s.specialty)),
    hospitals: unique(allSlots.map((s) => s.hospital)),
    quotas: unique(allSlots.map((s) => s.quota)),
  };

  // ── Filter ──────────────────────────────────────────────────────────────
  const term = filters.search?.trim().toLowerCase();

  const slots = allSlots.filter((slot) => {
    if (filters.program && slot.program !== filters.program) return false;
    if (filters.specialty && slot.specialty !== filters.specialty) return false;
    if (filters.hospital && slot.hospital !== filters.hospital) return false;
    if (filters.quota && slot.quota !== filters.quota) return false;

    if (filters.status === "joined" && slot.joined === 0) return false;
    if (filters.status === "pending" && slot.joined === slot.people.length) return false;

    if (!term) return true;
    return slot.people.some(
      (p) =>
        p.name?.toLowerCase().includes(term) || String(p.applicantId).includes(term)
    );
  });

  return {
    ok: true,
    summary,
    slots,
    empty,
    facets,
    totalSlots: allSlots.length,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}
