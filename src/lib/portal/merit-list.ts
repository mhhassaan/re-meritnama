import "server-only";

import { createClient } from "@/lib/supabase/server";
import { CURRENT_INDUCTION } from "@/lib/induction";
import {
  loadPreferenceIndex,
  loadPublishedNames,
  loadSeatRows,
} from "./pool-cache";
import { activeScope, eligibleUnder } from "./config";
import { quotaTrack, type QuotaTrack } from "./placement";

/**
 * The portal's Merit List: published placements, seat by seat.
 *
 * This is the tab the live portal is built around, and it is a different view
 * of the same rows `/app/merit-lists` shows as a flat table. The difference is
 * the unit. That page answers "where does this candidate appear"; this one
 * answers "who is sitting in this seat, and who is behind them" — so the row is
 * a seat, not a person.
 *
 * ## Where the data comes from
 *
 * Occupants are `merit_entries`, Tier 1, read **as the caller**. Capacities are
 * `seats`, also as the caller. Neither bypasses RLS.
 *
 * The next-in-line queue needs every applicant's preference list, which no user
 * may read for anyone but themselves. That comes from `public.applicants` via
 * the service role — a table with no name and no contact details, for the
 * reasons set out in `./data.ts`. Names in the queue come back from
 * `merit_entries`, so an applicant who has never been published stays an id.
 */

const PAGE = 1000;

export type ConsentState = "Accepted" | "Excluded" | "Awaited";

export type Occupant = {
  applicantId: number;
  name: string;
  pmdc: string | null;
  mark: number | null;
  preferenceNo: number | null;
  consent: ConsentState;
  track: QuotaTrack;
};

/** Why a candidate in the queue can or cannot take the seat. */
export type QueueTag =
  | "fresh"
  | "upgrade"
  | "higher-pref"
  | "locked-other-programme";

export type QueueEntry = {
  applicantId: number;
  name: string | null;
  mark: number;
  preferenceNo: number;
  tag: QueueTag;
  /** Where the published round already places them, if anywhere. */
  placedAt: { specialty: string; hospital: string; program: string; quota: string; preferenceNo: number } | null;
};

export type MeritSlot = {
  program: string;
  quota: string;
  specialty: string;
  hospital: string;
  capacity: number;
  occupants: Occupant[];
  /**
   * The head of the queue, best effective mark first.
   *
   * Truncated to `QUEUE_HEAD`. The full queue for a popular seat runs to
   * hundreds — one FCPS slot has 585 — and every one of the 742 slots on this
   * page would otherwise be serialised into the payload sent to the browser,
   * for a list that is collapsed by default and shows 25 when opened.
   */
  queue: QueueEntry[];
  /** The true length, before truncation. */
  queueLength: number;
  /** How many of the whole queue could actually take the seat if it opened. */
  available: number;
};

/** How much of each queue reaches the client. The card renders 25. */
const QUEUE_HEAD = 25;

/**
 * Seats per page.
 *
 * A round covers ~740 seats. Sending all of them cost twice: every queue head
 * was serialised into the RSC payload, and every card is a client component
 * that then has to hydrate. Twenty-four fills twelve rows of the two-column
 * grid, which is more than anyone scrolls before filtering.
 */
export const SLOTS_PER_PAGE = 24;

export type MeritListSummary = {
  round: number;
  rounds: number[];
  total: number;
  accepted: number;
  excluded: number;
  awaited: number;
  seats: number;
  slots: number;
};

export type Tidbits = {
  /** In both an Armed Force and a civilian quota within one programme. */
  multiTrack: Array<{ applicantId: number; name: string; programs: string[] }>;
  /** Placed in more than one programme. */
  multiProgramme: Array<{ applicantId: number; name: string; programs: string[] }>;
};

export type MeritListFilters = {
  round: number;
  program?: string;
  specialty?: string;
  hospital?: string;
  quota?: string;
  consent?: ConsentState;
  search?: string;
  /** 1-based. Out-of-range values are clamped rather than rejected. */
  page?: number;
  /**
   * The published rounds, when the caller has already fetched them.
   *
   * The page needs them before it can decide which round to ask for, so
   * without this the DISTINCT over the round view runs twice per request.
   */
  rounds?: number[];
};

const t = (v: string | null | undefined) => (v ?? "").trim();
const slotKey = (program: string, specialty: string, hospital: string, quota: string) =>
  `${t(program)}|${t(specialty)}|${t(hospital)}|${t(quota)}`;

/**
 * The consent state a merit row is in.
 *
 * The source records `Accepted`, `Rejected` and `Awaited`. The portal renders
 * the middle one as **Excluded**, because a rejection is not the only way to
 * lose a seat — a candidate who accepted a different slot is dropped from this
 * one without ever rejecting it. Both read as "this seat is vacant" and the
 * portal's vocabulary says so.
 */
function consentOf(status: string | null): ConsentState {
  if (status === "Accepted") return "Accepted";
  if (status === "Awaited") return "Awaited";
  return "Excluded";
}

/** Which rounds have been published for a cycle. */
export async function loadRounds(
  induction: number = CURRENT_INDUCTION
): Promise<number[]> {
  const supabase = await createClient();

  // The view does the DISTINCT in the database. Reducing rows here silently
  // loses rounds: PostgREST caps a response at 1000 and round 1 alone exceeds
  // it, so every cycle would look like it had exactly one round.
  const { data, error } = await supabase
    .from("merit_list_rounds")
    .select("round")
    .eq("induction", induction)
    .order("round");

  if (error || !data) return [];
  return [...new Set(data.map((r) => r.round).filter((r): r is number => r != null))];
}

type MeritRow = {
  applicant_id: number;
  name_full: string;
  pmdc_no: string | null;
  program: string;
  quota: string;
  specialty: string;
  hospital: string;
  marks_total: number | null;
  preference_no: number | null;
  consent_status: string | null;
};

async function loadRoundEntries(
  induction: number,
  round: number
): Promise<MeritRow[]> {
  const supabase = await createClient();
  const out: MeritRow[] = [];

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("merit_entries")
      .select(
        "applicant_id, name_full, pmdc_no, program, quota, specialty, hospital, marks_total, preference_no, consent_status"
      )
      .eq("induction", induction)
      .eq("round", round)
      .order("applicant_id")
      .range(from, from + PAGE - 1);

    // An RLS denial is an empty result, not an exception.
    if (error || !data?.length) break;
    out.push(...(data as MeritRow[]));
    if (data.length < PAGE) break;
  }

  return out;
}

/**
 * Seat capacities, keyed by seat.
 *
 * Built from the cached seat rows rather than its own query — the same 873 rows
 * every portal page needs.
 */
async function loadCapacities(induction: number): Promise<Map<string, number>> {
  const rows = await loadSeatRows(induction);
  const out = new Map<string, number>();
  for (const row of rows) {
    out.set(slotKey(row.program, row.specialty, row.hospital, row.quota), row.seats);
  }
  return out;
}

export type MeritListView = {
  summary: MeritListSummary;
  slots: MeritSlot[];
  tidbits: Tidbits;
  facets: {
    programs: string[];
    specialties: string[];
    hospitals: string[];
    quotas: string[];
  };
  /** Slots before filtering, so the count can say "N of M". */
  totalSlots: number;
  /** Slots after filtering, before the page slice. */
  matchedSlots: number;
  page: number;
  pageCount: number;
  pageSize: number;
};

/**
 * Build the view for one round.
 *
 * ## Why the queues are built last
 *
 * `buildQueue` is the expensive half of this module: it walks everyone who
 * listed a seat — 180,784 preference entries across the cycle, one popular slot
 * alone holding 585 — and sorts each list. Doing it for all ~740 slots, then
 * truncating each to 25 and serialising the lot, was most of the page's cost,
 * and all but a page of it was thrown away by a UI that shows 24 cards.
 *
 * So the slots are assembled with their occupants, filtered, sorted and
 * **paged**, and only then does the page's own slots get a queue. The counts
 * that describe the whole round are computed before the slice, so paging
 * changes what is drawn and never what is claimed.
 */
export async function loadMeritList(
  filters: MeritListFilters,
  induction: number = CURRENT_INDUCTION
): Promise<MeritListView> {
  const [rounds, entries, capacities, index, names] = await Promise.all([
    filters.rounds ?? loadRounds(induction),
    loadRoundEntries(induction, filters.round),
    loadCapacities(induction),
    loadPreferenceIndex(induction),
    loadPublishedNames(induction),
  ]);

  const { effectiveMark, wantedBy } = index;

  // Whom the queues count as competing. The reader's status scope, from the
  // Config tab — "Accepted only" by default, which is what `index.eligible`
  // already holds, so the common path costs nothing.
  const scope = await activeScope();
  const eligible =
    scope.id === "accepted" ? index.eligible : eligibleUnder(index.statusById, scope);

  // The effective mark, who wants which seat, and who is verified all come from
  // the cached index. Building them here walked 180,784 preferences on every
  // request and kept this page at six seconds even once the fetch was cached.

  // ── Where the published round already puts everyone ─────────────────────
  const placedAt = new Map<
    number,
    Array<{ key: string; specialty: string; hospital: string; program: string; quota: string; preferenceNo: number }>
  >();

  for (const entry of entries) {
    // Only a seat actually held counts as a placement. An excluded row is a
    // vacancy, and treating it as a placement would make the person look
    // settled when they are the reason the seat is open.
    if (consentOf(entry.consent_status) !== "Accepted") continue;

    const key = slotKey(entry.program, entry.specialty, entry.hospital, entry.quota);
    const list = placedAt.get(entry.applicant_id) ?? [];
    list.push({
      key,
      specialty: t(entry.specialty),
      hospital: t(entry.hospital),
      program: t(entry.program),
      quota: t(entry.quota),
      preferenceNo: entry.preference_no ?? 999,
    });
    placedAt.set(entry.applicant_id, list);
  }

  // ── Group the round into slots ──────────────────────────────────────────
  const grouped = new Map<string, MeritRow[]>();
  for (const entry of entries) {
    const key = slotKey(entry.program, entry.specialty, entry.hospital, entry.quota);
    const list = grouped.get(key) ?? [];
    list.push(entry);
    grouped.set(key, list);
  }

  /** A slot with its occupants but no queue yet. */
  type SlotShell = Omit<MeritSlot, "queue" | "queueLength" | "available"> & {
    key: string;
  };

  const allSlots: SlotShell[] = [];

  for (const [key, rows] of grouped) {
    const [program, specialty, hospital, quota] = key.split("|");

    const occupants: Occupant[] = rows
      .map((row) => ({
        applicantId: row.applicant_id,
        name: row.name_full,
        pmdc: row.pmdc_no,
        mark: row.marks_total != null ? Number(row.marks_total) : null,
        preferenceNo: row.preference_no,
        consent: consentOf(row.consent_status),
        track: quotaTrack(row.quota),
      }))
      // Accepted first, then by mark — the published order within a slot is not
      // meaningful, and a reader wants the people actually holding it at the top.
      .sort(
        (a, b) =>
          Number(b.consent === "Accepted") - Number(a.consent === "Accepted") ||
          (b.mark ?? 0) - (a.mark ?? 0)
      );

    allSlots.push({
      key,
      program,
      quota,
      specialty,
      hospital,
      capacity: capacities.get(key) ?? occupants.length,
      occupants,
    });
  }

  allSlots.sort(
    (a, b) =>
      a.specialty.localeCompare(b.specialty) ||
      a.hospital.localeCompare(b.hospital) ||
      a.quota.localeCompare(b.quota)
  );

  // ── Summary, over the WHOLE round rather than the filter ────────────────
  //
  // A total that moved when a programme was selected would be answering a
  // different question from the one the header asks.
  const summary: MeritListSummary = {
    round: filters.round,
    rounds,
    total: entries.length,
    accepted: entries.filter((e) => consentOf(e.consent_status) === "Accepted").length,
    excluded: entries.filter((e) => consentOf(e.consent_status) === "Excluded").length,
    awaited: entries.filter((e) => consentOf(e.consent_status) === "Awaited").length,
    seats: [...capacities.values()].reduce((sum, n) => sum + n, 0),
    slots: capacities.size,
  };

  const facets = {
    programs: unique(allSlots.map((s) => s.program)),
    specialties: unique(allSlots.map((s) => s.specialty)),
    hospitals: unique(allSlots.map((s) => s.hospital)),
    quotas: unique(allSlots.map((s) => s.quota)),
  };

  // ── Filter ──────────────────────────────────────────────────────────────
  const term = filters.search?.trim().toLowerCase();

  const matched = allSlots.filter((slot) => {
    if (filters.program && slot.program !== filters.program) return false;
    if (filters.specialty && slot.specialty !== filters.specialty) return false;
    if (filters.hospital && slot.hospital !== filters.hospital) return false;
    if (filters.quota && slot.quota !== filters.quota) return false;
    if (filters.consent && !slot.occupants.some((o) => o.consent === filters.consent))
      return false;

    if (!term) return true;
    return slot.occupants.some(
      (o) =>
        o.name.toLowerCase().includes(term) ||
        o.pmdc?.toLowerCase().includes(term) ||
        String(o.applicantId).includes(term)
    );
  });

  // ── Page ────────────────────────────────────────────────────────────────
  //
  // Clamped rather than rejected: a hand-edited `?page=99` should land on the
  // last page, and a filter that shrinks the result should not 404 the reader
  // out of a URL they were already on.
  const pageCount = Math.max(1, Math.ceil(matched.length / SLOTS_PER_PAGE));
  const page = Math.min(Math.max(1, Math.trunc(filters.page ?? 1) || 1), pageCount);
  const pageSlots = matched.slice((page - 1) * SLOTS_PER_PAGE, page * SLOTS_PER_PAGE);

  const slots: MeritSlot[] = pageSlots.map(({ key, ...slot }) => {
    const queue = buildQueue({
      key,
      program: slot.program,
      wantedBy,
      effectiveMark,
      eligible,
      placedAt,
      names,
      occupants: slot.occupants,
    });

    return {
      ...slot,
      // Counted over the WHOLE queue, then truncated — the figures describe the
      // real competition, not the slice that happens to be sent.
      queueLength: queue.length,
      available: queue.filter((q) => q.tag === "fresh" || q.tag === "upgrade").length,
      queue: queue.slice(0, QUEUE_HEAD),
    };
  });

  return {
    summary,
    slots,
    tidbits: buildTidbits(entries),
    facets,
    totalSlots: allSlots.length,
    matchedSlots: matched.length,
    page,
    pageCount,
    pageSize: SLOTS_PER_PAGE,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

/**
 * Who is behind the people currently in a seat.
 *
 * Ranked by the mark that applies to THIS seat. Everyone who listed it is
 * included, because the reader wants to know the shape of the competition — but
 * each is tagged with whether they would actually move, which is the difference
 * between a queue and a list of names.
 */
function buildQueue({
  key,
  program,
  wantedBy,
  effectiveMark,
  eligible,
  placedAt,
  names,
  occupants,
}: {
  key: string;
  program: string;
  wantedBy: Map<string, Array<{ applicantId: number; preferenceNo: number }>>;
  effectiveMark: Map<string, number>;
  eligible: Set<number>;
  placedAt: Map<
    number,
    Array<{ key: string; specialty: string; hospital: string; program: string; quota: string; preferenceNo: number }>
  >;
  names: Map<number, string>;
  occupants: Occupant[];
}): QueueEntry[] {
  const sitting = new Set(
    occupants.filter((o) => o.consent === "Accepted").map((o) => o.applicantId)
  );

  const entries: QueueEntry[] = [];

  for (const want of wantedBy.get(key) ?? []) {
    if (sitting.has(want.applicantId)) continue;
    if (!eligible.has(want.applicantId)) continue;

    const held = placedAt.get(want.applicantId) ?? [];
    const best = held.length
      ? held.reduce((a, b) => (a.preferenceNo <= b.preferenceNo ? a : b))
      : null;

    let tag: QueueTag;
    if (!best) {
      tag = "fresh";
    } else if (best.program !== program) {
      // Holding a seat in another programme. Once they consent there they are
      // restricted to it, so they cannot be counted on to take this one.
      tag = "locked-other-programme";
    } else if (best.preferenceNo < want.preferenceNo) {
      tag = "higher-pref";
    } else {
      tag = "upgrade";
    }

    entries.push({
      applicantId: want.applicantId,
      // Published names only. Anyone who has never appeared in a merit list has
      // never been named by anyone, and a queue is not where that changes.
      name: names.get(want.applicantId) ?? null,
      mark: effectiveMark.get(`${want.applicantId}::${key}`) ?? 0,
      preferenceNo: want.preferenceNo,
      tag,
      placedAt: best
        ? {
            specialty: best.specialty,
            hospital: best.hospital,
            program: best.program,
            quota: best.quota,
            preferenceNo: best.preferenceNo,
          }
        : null,
    });
  }

  return entries.sort((a, b) => b.mark - a.mark || a.applicantId - b.applicantId);
}

/**
 * The sidebar the portal calls Tidbits.
 *
 * Two lists that explain otherwise baffling movement: a candidate holding seats
 * under both an Armed Force and a civilian quota, and one placed in more than
 * one programme. Both vanish from slots they were leading the moment they
 * consent somewhere, and without this list that looks like a bug.
 *
 * The original prints each name with their father's name. That is on
 * `candidates`, Tier 2, and is not published anywhere — so it is not shown
 * here. The applicant id already disambiguates.
 */
function buildTidbits(entries: MeritRow[]): Tidbits {
  const byCandidate = new Map<
    number,
    { name: string; programs: Set<string>; tracks: Map<string, Set<QuotaTrack>> }
  >();

  for (const entry of entries) {
    const record = byCandidate.get(entry.applicant_id) ?? {
      name: entry.name_full,
      programs: new Set<string>(),
      tracks: new Map<string, Set<QuotaTrack>>(),
    };

    const program = t(entry.program);
    record.programs.add(program);

    const tracks = record.tracks.get(program) ?? new Set<QuotaTrack>();
    tracks.add(quotaTrack(entry.quota));
    record.tracks.set(program, tracks);

    byCandidate.set(entry.applicant_id, record);
  }

  const multiTrack: Tidbits["multiTrack"] = [];
  const multiProgramme: Tidbits["multiProgramme"] = [];

  for (const [applicantId, record] of byCandidate) {
    const programs = [...record.programs].sort();

    if ([...record.tracks.values()].some((set) => set.size > 1)) {
      multiTrack.push({ applicantId, name: record.name, programs });
    }
    if (record.programs.size > 1) {
      multiProgramme.push({ applicantId, name: record.name, programs });
    }
  }

  const byId = (a: { applicantId: number }, b: { applicantId: number }) =>
    a.applicantId - b.applicantId;

  return { multiTrack: multiTrack.sort(byId), multiProgramme: multiProgramme.sort(byId) };
}
