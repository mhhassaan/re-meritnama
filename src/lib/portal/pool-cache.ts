import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { PlacementPreference } from "./placement";

/**
 * Cached loaders for the portal's bulk inputs.
 *
 * ## The problem this solves
 *
 * The allocation pool is 3,474 rows, and each one carries a preference list and
 * a certificate list as jsonb. Measured against the real project, one page of
 * 1,000 rows is **11.25 MB and 1.9 seconds**; the whole pool is four pages,
 * about 39 MB. Every page that touches the engine was paying that on every
 * request, then parsing 39 MB of JSON and rebuilding the same maps.
 *
 * Measured render times before caching:
 *
 *     /app/portal/slots        48.5 s
 *     /app/portal/merit-list   38.8 s
 *     /app/portal/allocation   33.0 s
 *
 * This is not a database bottleneck and not a connection-pooling one — the
 * client speaks HTTP to PostgREST and holds no Postgres connections at all. It
 * is volume, fetched repeatedly.
 *
 * ## Why a cache is the right answer here
 *
 * These inputs change only when the ingest pipeline runs, which is between
 * induction rounds — not between requests. Re-fetching per request was buying
 * freshness that does not exist.
 *
 * The cache is per process and in memory. A deployment with several instances
 * holds a copy in each, which is fine: the data is read-only, derived, and
 * identical everywhere. `TTL_MS` bounds how long a run of the ingest pipeline
 * can go unnoticed.
 *
 * ## What is deliberately NOT cached
 *
 * Anything read as the calling user. Caching a per-user read across users would
 * serve one person's row to another — the cache would become an access-control
 * bypass. Only `loadPool` (service role, no personal columns) and the two
 * whole-cycle reference sets are held, and each is keyed by induction.
 */

const TTL_MS = 5 * 60 * 1000;

type Entry<T> = { value: T; at: number };

const store = new Map<string, Entry<unknown>>();

/**
 * Also caches the in-flight promise, not just the result.
 *
 * Without this, two requests arriving before the first finishes each start
 * their own 39 MB fetch — which is exactly what happens when a page loads and
 * the user immediately clicks something.
 */
const inFlight = new Map<string, Promise<unknown>>();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = load()
    .then((value) => {
      store.set(key, { value, at: Date.now() });
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

/** Drops everything. Call after an ingest run if the process stays up. */
export function clearPortalCache(): void {
  store.clear();
}

const PAGE = 1000;

export type PoolRow = {
  applicant_id: number;
  marks_total: number | null;
  preferences: PlacementPreference[];
  certificates: Array<{ program_id: number; discipline_id: number; marks: number }>;
  profile_status: number | null;
};

/**
 * The allocation pool.
 *
 * Service role, because modelling competition honestly means reading every
 * applicant's preferences and no user may read another's. Safe to bypass RLS
 * because `public.applicants` carries no name and no contact details — see
 * `./data.ts` for the full reasoning.
 */
export function loadPool(induction: number): Promise<PoolRow[]> {
  return cached(`pool:${induction}`, async () => {
    const admin = createAdminClient();
    const out: PoolRow[] = [];

    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin
        .from("applicants")
        .select("applicant_id, marks_total, preferences, certificates, profile_status")
        .eq("induction", induction)
        .order("applicant_id")
        .range(from, from + PAGE - 1);

      if (error) throw new Error(`allocation pool: ${error.message}`);
      if (!data?.length) break;
      out.push(...(data as unknown as PoolRow[]));
      if (data.length < PAGE) break;
    }

    return out;
  });
}

/**
 * Every name the gazette has published for a cycle, across all rounds.
 *
 * Read as the CALLER, so a user who may not see merit entries gets nothing —
 * and then cached, which is only sound because the result does not vary by
 * user: `merit_entries` is Tier 1, visible in full to every verified user. If
 * that policy ever narrows, this must stop being cached.
 */
export function loadPublishedNames(induction: number): Promise<Map<number, string>> {
  return cached(`names:${induction}`, async () => {
    const supabase = await createClient();
    const names = new Map<number, string>();

    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("merit_entries")
        .select("applicant_id, name_full")
        .eq("induction", induction)
        .order("applicant_id")
        .range(from, from + PAGE - 1);

      if (error || !data?.length) break;
      for (const row of data) {
        if (!names.has(row.applicant_id)) names.set(row.applicant_id, row.name_full);
      }
      if (data.length < PAGE) break;
    }

    return names;
  });
}

export type SeatRow = {
  program: string;
  quota: string;
  specialty: string;
  hospital: string;
  institute: string | null;
  seats: number;
};

/**
 * Seat capacities.
 *
 * Also read as the caller, and cacheable for the same reason: `seats` carries
 * no personal data and every verified user sees all of it.
 */
export function loadSeatRows(induction: number): Promise<SeatRow[]> {
  return cached(`seats:${induction}`, async () => {
    const supabase = await createClient();
    const out: SeatRow[] = [];

    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("seats")
        .select("program, quota, specialty, hospital, institute, seats")
        .eq("induction", induction)
        .order("program")
        .order("specialty")
        .order("hospital")
        .range(from, from + PAGE - 1);

      if (error || !data?.length) break;
      out.push(...(data as SeatRow[]));
      if (data.length < PAGE) break;
    }

    return out;
  });
}

export type PreferenceIndex = {
  /** `applicantId::seatKey` to aggregate plus the bonus applying to that seat. */
  effectiveMark: Map<string, number>;
  /** Aggregate alone, for a seat the candidate did not list. */
  baseMark: Map<number, number>;
  /** Seat key to everyone who listed it, with the preference number they gave. */
  wantedBy: Map<string, Array<{ applicantId: number; preferenceNo: number }>>;
  /**
   * Verification passed under the DEFAULT scope. Status 1 only.
   *
   * Kept as a field rather than derived everywhere, because it is what every
   * caller wanted before the Config tab existed and it is still the right
   * answer for all of them unless the reader has asked otherwise.
   */
  eligible: Set<number>;
  /**
   * Raw verification status per applicant, so a different status scope can be
   * applied without rebuilding the index.
   *
   * The index is cached per induction and the scope is per reader, so the scope
   * must never be baked into it — two readers share this object.
   */
  statusById: Map<number, number | null>;
};

const seatKeyOf = (
  program: string,
  specialty: string,
  hospital: string,
  quota: string
) =>
  `${(program ?? "").trim()}|${(specialty ?? "").trim()}|${(hospital ?? "").trim()}|${(quota ?? "").trim()}`;

/**
 * The pool, inverted into the shape every portal surface actually queries.
 *
 * Cached separately from the pool itself because building it is not free: it
 * walks 180,784 preferences and, for each, finds the best certificate bonus in
 * a discipline that preference names. Doing that per request kept the Merit
 * List at six seconds even once the fetch was cached.
 *
 * A pure function of the pool, so it is safe to hold for exactly as long.
 */
export function loadPreferenceIndex(induction: number): Promise<PreferenceIndex> {
  return cached(`prefs:${induction}`, async () => {
    const pool = await loadPool(induction);

    const effectiveMark = new Map<string, number>();
    const baseMark = new Map<number, number>();
    const wantedBy = new Map<string, Array<{ applicantId: number; preferenceNo: number }>>();
    const eligible = new Set<number>();
    const statusById = new Map<number, number | null>();

    for (const row of pool) {
      const base = Number(row.marks_total ?? 0);
      baseMark.set(row.applicant_id, base);
      statusById.set(row.applicant_id, row.profile_status ?? null);
      if (row.profile_status === 1) eligible.add(row.applicant_id);

      // Best certificate per programme and discipline. A bonus only counts on a
      // seat whose preference names the same discipline, so one earned
      // elsewhere must not lift the candidate here.
      const best = new Map<string, number>();
      for (const cert of row.certificates ?? []) {
        const key = `${cert.program_id}_${cert.discipline_id}`;
        if (cert.marks > (best.get(key) ?? -Infinity)) best.set(key, cert.marks);
      }

      for (const pref of row.preferences ?? []) {
        const key = seatKeyOf(pref.program, pref.specialty, pref.hospital, pref.quota);

        const disciplineIds =
          (pref as PlacementPreference & { discipline_ids?: number[] }).discipline_ids ?? [];
        const programId = (pref as PlacementPreference & { program_id?: number }).program_id;

        let bonus = 0;
        for (const disciplineId of disciplineIds) {
          const value = best.get(`${programId}_${disciplineId}`) ?? 0;
          if (value > bonus) bonus = value;
        }

        effectiveMark.set(`${row.applicant_id}::${key}`, base + bonus);

        const list = wantedBy.get(key);
        if (list) list.push({ applicantId: row.applicant_id, preferenceNo: pref.preference_no });
        else wantedBy.set(key, [{ applicantId: row.applicant_id, preferenceNo: pref.preference_no }]);
      }
    }

    return { effectiveMark, baseMark, wantedBy, eligible, statusById };
  });
}
