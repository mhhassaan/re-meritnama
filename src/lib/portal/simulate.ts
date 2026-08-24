"use server";

import { createClient } from "@/lib/supabase/server";
import { CURRENT_INDUCTION } from "@/lib/induction";
import {
  loadPool,
  loadPreferenceIndex,
  loadPublishedNames,
  loadSeatRows,
} from "./pool-cache";
import {
  runCascade,
  type Candidate,
  type ConsentRow,
  type MeritEntry,
  type Preference,
  type SeatCapacityRow,
} from "./cascade";
import type { ConsentState } from "./merit-list";
import { MANUAL_ID_BASE, type ManualCandidate } from "./manual-candidate";

/**
 * Simulate the next round.
 *
 * Runs the cascade engine — the one graded at 93.3% against the published round
 * 2 and 91.8% across all seven pairs — against the round on screen, with
 * whatever consent decisions the reader has toggled. It answers the question
 * the portal exists for: *if these people decline, what moves?*
 *
 * ## The gate
 *
 * This reads the full applicant pool with the service role, so it must not run
 * for anyone who could not otherwise see the merit list. The check reuses the
 * existing policy rather than reimplementing it: `seats` is readable only by a
 * verified signed-in user, so if reading it as the caller returns nothing, the
 * caller is not verified and the action stops. Reimplementing the rule here
 * would be a second place for it to drift.
 *
 * ## What comes back
 *
 * A change log and counts, not a new grid. The published round stays on screen
 * as the reference; the simulation says what would move against it. Returning a
 * whole replacement grid would double an already 4 MB payload for a view the
 * reader is comparing to, not replacing.
 *
 * ## The manual candidate
 *
 * A reader who is not in any published round can supply themselves — name,
 * marks and a preference list — and compete. That candidate arrives as an
 * argument, is used for this one run, and is never written anywhere. It is
 * unverified by construction: a form anyone can type into is not evidence, and
 * storing it beside the ingested gazette would make an assertion
 * indistinguishable from a published fact a month later.
 *
 * Their id is forced into the manual range on arrival, so a caller cannot pass
 * a real applicant id and have their invented marks merged into a real
 * person's record for the run.
 */

export type ConsentOverride = {
  applicantId: number;
  /** `program|specialty|hospital|quota`. */
  seatKey: string;
  status: ConsentState;
};

export type SeatRef = {
  program: string;
  specialty: string;
  hospital: string;
  quota: string;
};

export type Change = {
  applicantId: number;
  name: string | null;
  mark: number;
  preferenceNo: number;
  from: SeatRef | null;
  to: SeatRef | null;
};

export type SimulationResult =
  | {
      ok: true;
      round: number;
      /**
       * How the manual candidate fared, if one competed.
       *
       * `standings` matters more than `placed`. The cascade only fills seats
       * that become VACANT — it is a between-rounds engine, not a
       * re-allocation — so a new entrant with the highest marks in the cycle
       * still takes nothing unless a seat on their list opens. Reporting only
       * "not placed" would read as the feature being broken. Standing answers
       * the question they actually have: where would I rank for this seat.
       */
      manual: {
        placed: boolean;
        seat: SeatRef | null;
        preferenceNo: number | null;
        standings: Array<{
          seat: SeatRef;
          preferenceNo: number;
          /** 1 means the strongest applicant who listed this seat. */
          rank: number;
          competitors: number;
          capacity: number;
        }>;
      } | null;
      /** Placements that did not exist in the round being simulated from. */
      placed: Change[];
      /** Moved to a seat they ranked higher. */
      upgraded: Change[];
      /** Lost their seat and took nothing else. */
      removed: Change[];
      stats: {
        waves: number;
        vacanciesOpened: number;
        totalPlacements: number;
        totalUpgrades: number;
        seatsUnfilled: number;
        overridesApplied: number;
      };
    }
  | { ok: false; error: string };

const t = (v: string | null | undefined) => (v ?? "").trim();
const keyOf = (program: string, specialty: string, hospital: string, quota: string) =>
  `${t(program)}|${t(specialty)}|${t(hospital)}|${t(quota)}`;

const refOf = (key: string): SeatRef => {
  const [program, specialty, hospital, quota] = key.split("|");
  return { program, specialty, hospital, quota };
};

/** Our vocabulary to the engine's. `Excluded` covers rejected and dropped. */
function toCascadeStatus(state: ConsentState): "Accepted" | "Rejected" | "Awaited" {
  if (state === "Accepted") return "Accepted";
  if (state === "Awaited") return "Awaited";
  return "Rejected";
}

export async function simulateNextRound(
  round: number,
  overrides: ConsentOverride[],
  manual?: ManualCandidate | null,
  induction: number = CURRENT_INDUCTION
): Promise<SimulationResult> {
  const supabase = await createClient();

  // The gate. `seats` is readable only by a verified user, so this is the same
  // rule the rest of the portal enforces rather than a second copy of it.
  const { data: gate } = await supabase
    .from("seats")
    .select("id")
    .eq("induction", induction)
    .limit(1);

  if (!gate?.length) {
    return { ok: false, error: "Not available — verify your account to run a simulation." };
  }

  // ── The round being simulated from ──────────────────────────────────────
  const entries: Array<{
    applicant_id: number;
    program: string;
    quota: string;
    specialty: string;
    hospital: string;
    marks_total: number | null;
    preference_no: number | null;
    consent_status: string | null;
  }> = [];

  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("merit_entries")
      .select(
        "applicant_id, program, quota, specialty, hospital, marks_total, preference_no, consent_status"
      )
      .eq("induction", induction)
      .eq("round", round)
      .order("applicant_id")
      .range(from, from + 999);

    if (error || !data?.length) break;
    entries.push(...data);
    if (data.length < 1000) break;
  }

  if (!entries.length) {
    return { ok: false, error: `Round ${round} has no published entries to simulate from.` };
  }

  const [pool, publishedNames, seatRows, index] = await Promise.all([
    loadPool(induction),
    loadPublishedNames(induction),
    loadSeatRows(induction),
    loadPreferenceIndex(induction),
  ]);

  // `loadPublishedNames` is CACHED and shared across every request and every
  // user. Writing the manual candidate into it directly would leak one reader's
  // self-supplied name into everybody else's pages until the cache expired.
  // Copied only when there is something to add.
  const names = manual?.preferences.length
    ? new Map(publishedNames)
    : publishedNames;

  // ── Adapt the database shapes to the engine's ───────────────────────────
  //
  // `cascade.ts` takes the raw PHF file shapes, because that is what it is
  // graded against and changing it to suit storage would invalidate the
  // oracle. Preferences arrive from the database with specialty already
  // resolved to a name, so the specialty ids the engine expects are synthesised
  // here — a stable numbering over the distinct names, with the matching table
  // handed straight back. Equivalent, and it keeps the tested module untouched.
  const specialtyId = new Map<string, number>();
  const specialties = new Map<number, string>();
  const idFor = (name: string) => {
    const clean = t(name);
    let id = specialtyId.get(clean);
    if (id == null) {
      id = specialtyId.size + 1;
      specialtyId.set(clean, id);
      specialties.set(id, clean);
    }
    return id;
  };

  const seats: SeatCapacityRow[] = seatRows.map((row) => ({
    typeName: t(row.program),
    specialityName: t(row.specialty),
    hospitalName: t(row.hospital),
    quotaName: t(row.quota),
    seats: row.seats,
  }));
  for (const row of seatRows) idFor(row.specialty);

  const programIdOf = new Map<string, number>();
  const programId = (name: string) => {
    const clean = t(name);
    let id = programIdOf.get(clean);
    if (id == null) {
      id = programIdOf.size + 1;
      programIdOf.set(clean, id);
    }
    return id;
  };

  const candidates = new Map<number, Candidate>();
  const certificates = new Map<
    number,
    Array<{ typeId: number; disciplineId: number; certificateMarks?: number }>
  >();

  for (const row of pool) {
    const preferences: Preference[] = (row.preferences ?? []).map((pref) => ({
      specialityId: idFor(pref.specialty),
      typeName: t(pref.program),
      typeId: programId(pref.program),
      hospitalName: t(pref.hospital),
      quotaName: t(pref.quota),
      preferenceNo: pref.preference_no,
      disciplineIds:
        (pref as typeof pref & { discipline_ids?: number[] }).discipline_ids ?? [],
    }));

    candidates.set(row.applicant_id, {
      applicantId: row.applicant_id,
      nameFull: names.get(row.applicant_id) ?? "",
      marksTotal: Number(row.marks_total ?? 0),
      preferences,
    });

    certificates.set(
      row.applicant_id,
      (row.certificates ?? []).map((cert) => ({
        // The engine keys a bonus on the PREFERENCE's programme id, so the
        // certificate has to be renumbered into the same scheme or no bonus
        // ever matches and every effective mark collapses to the aggregate.
        typeId: cert.program_id,
        disciplineId: cert.discipline_id,
        certificateMarks: cert.marks,
      }))
    );
  }

  // Certificates carry the SOURCE programme ids, while preferences now carry
  // our synthesised ones. Re-map so the two agree.
  const sourceProgramId = new Map<number, number>();
  for (const row of pool) {
    for (const pref of row.preferences ?? []) {
      const source = (pref as typeof pref & { program_id?: number }).program_id;
      if (source != null) sourceProgramId.set(source, programId(pref.program));
    }
  }
  for (const [applicantId, certs] of certificates) {
    certificates.set(
      applicantId,
      certs.map((cert) => ({
        ...cert,
        typeId: sourceProgramId.get(cert.typeId) ?? cert.typeId,
      }))
    );
  }

  const profileStatus = new Map<number, number | null>();
  for (const row of pool) profileStatus.set(row.applicant_id, row.profile_status);

  // ── The manual candidate, if one was supplied ───────────────────────────
  //
  // Added to the pool for this run only. The id is forced into the manual
  // range rather than trusted, so a caller cannot pass a real applicant id and
  // have invented marks merged into a real person's record.
  let manualId: number | null = null;

  if (manual && manual.preferences.length) {
    manualId = MANUAL_ID_BASE;

    const seatKeys = new Set(seats.map((s) => keyOf(s.typeName, s.specialityName, s.hospitalName, s.quotaName)));

    const preferences: Preference[] = manual.preferences
      // A preference naming a seat that does not exist would be dropped by the
      // engine anyway; filtering here keeps the numbering contiguous.
      .filter((pref) =>
        seatKeys.has(keyOf(pref.program, pref.specialty, pref.hospital, pref.quota))
      )
      .map((pref, i) => ({
        specialityId: idFor(pref.specialty),
        typeName: t(pref.program),
        typeId: programId(pref.program),
        hospitalName: t(pref.hospital),
        quotaName: t(pref.quota),
        preferenceNo: i + 1,
        disciplineIds: [],
      }));

    if (preferences.length) {
      candidates.set(manualId, {
        applicantId: manualId,
        nameFull: manual.name,
        marksTotal: manual.marksTotal,
        preferences,
      });
      // No certificates: nothing has been verified, so no bonus is applied.
      // Their effective mark is their aggregate on every seat.
      certificates.set(manualId, []);
      // Verification status 1, because the alternative is that they can never
      // be placed and the feature does nothing. This is stated on the form.
      profileStatus.set(manualId, 1);
      names.set(manualId, manual.name);
    } else {
      manualId = null;
    }
  }

  // ── The round, and the reader's edits on top of it ──────────────────────
  const overrideBy = new Map<string, ConsentState>();
  for (const o of overrides) {
    overrideBy.set(`${o.applicantId}::${o.seatKey}`, o.status);
  }

  const merit: MeritEntry[] = [];
  const consent: ConsentRow[] = [];
  const heldBefore = new Map<number, { key: string; preferenceNo: number }>();
  let overridesApplied = 0;

  for (const entry of entries) {
    const key = keyOf(entry.program, entry.specialty, entry.hospital, entry.quota);

    merit.push({
      applicantId: entry.applicant_id,
      typeName: t(entry.program),
      specialityName: t(entry.specialty),
      hospitalName: t(entry.hospital),
      quotaName: t(entry.quota),
      marksTotal: Number(entry.marks_total ?? 0),
      preferenceNo: entry.preference_no ?? 0,
    });

    const published: ConsentState =
      entry.consent_status === "Accepted"
        ? "Accepted"
        : entry.consent_status === "Awaited"
          ? "Awaited"
          : "Excluded";

    const override = overrideBy.get(`${entry.applicant_id}::${key}`);
    if (override && override !== published) overridesApplied++;
    const state = override ?? published;

    consent.push({
      applicantId: entry.applicant_id,
      status: toCascadeStatus(state),
      preferenceNo: entry.preference_no ?? 999,
      seatKey: key,
    });

    // What they hold going in — the baseline the change log is measured
    // against. Only an accepted seat counts as held.
    if (state === "Accepted") {
      const existing = heldBefore.get(entry.applicant_id);
      const preferenceNo = entry.preference_no ?? 999;
      if (!existing || preferenceNo < existing.preferenceNo) {
        heldBefore.set(entry.applicant_id, { key, preferenceNo });
      }
    }
  }

  const result = runCascade({
    merit,
    consent,
    seats,
    candidates,
    certificates,
    specialties,
    profileStatus: (applicantId) => profileStatus.get(applicantId) ?? null,
  });

  // ── Diff ────────────────────────────────────────────────────────────────
  const heldAfter = new Map<number, { key: string; preferenceNo: number; mark: number }>();
  for (const placement of result.placements) {
    const key = keyOf(
      placement.typeName,
      placement.specialityName,
      placement.hospitalName,
      placement.quotaName
    );
    const existing = heldAfter.get(placement.applicantId);
    if (!existing || placement.preferenceNo < existing.preferenceNo) {
      heldAfter.set(placement.applicantId, {
        key,
        preferenceNo: placement.preferenceNo,
        mark: placement.effectiveMark,
      });
    }
  }

  const placed: Change[] = [];
  const upgraded: Change[] = [];
  const removed: Change[] = [];

  const change = (
    applicantId: number,
    from: string | null,
    to: string | null,
    preferenceNo: number,
    mark: number
  ): Change => ({
    applicantId,
    name: names.get(applicantId) ?? null,
    mark,
    preferenceNo,
    from: from ? refOf(from) : null,
    to: to ? refOf(to) : null,
  });

  for (const [applicantId, after] of heldAfter) {
    const before = heldBefore.get(applicantId);
    if (!before) {
      placed.push(change(applicantId, null, after.key, after.preferenceNo, after.mark));
    } else if (before.key !== after.key) {
      upgraded.push(
        change(applicantId, before.key, after.key, after.preferenceNo, after.mark)
      );
    }
  }

  for (const [applicantId, before] of heldBefore) {
    if (heldAfter.has(applicantId)) continue;
    removed.push(
      change(
        applicantId,
        before.key,
        null,
        before.preferenceNo,
        Number(candidates.get(applicantId)?.marksTotal ?? 0)
      )
    );
  }

  const byMark = (a: Change, b: Change) => b.mark - a.mark || a.applicantId - b.applicantId;

  const manualPlacement = manualId != null ? heldAfter.get(manualId) : undefined;

  // Standing per listed seat: how the manual candidate's aggregate compares
  // with everyone else who wants it. Computed from the cached preference index
  // rather than the run, because it is a fact about the competition and holds
  // whether or not a seat happens to be vacant.
  const standings =
    manualId == null || !manual
      ? []
      : manual.preferences
          .map((pref, i) => {
            const key = keyOf(pref.program, pref.specialty, pref.hospital, pref.quota);
            const seatRow = seatRows.find(
              (s) =>
                keyOf(s.program, s.specialty, s.hospital, s.quota) === key
            );
            if (!seatRow) return null;

            const wanters = index.wantedBy.get(key) ?? [];
            let ahead = 0;
            let competitors = 0;

            for (const wanter of wanters) {
              if (!index.eligible.has(wanter.applicantId)) continue;
              competitors++;
              const mark =
                index.effectiveMark.get(`${wanter.applicantId}::${key}`) ??
                index.baseMark.get(wanter.applicantId) ??
                0;
              if (mark > manual.marksTotal) ahead++;
            }

            return {
              seat: refOf(key),
              preferenceNo: i + 1,
              rank: ahead + 1,
              competitors: competitors + 1,
              capacity: seatRow.seats,
            };
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry != null);

  return {
    ok: true,
    round,
    manual:
      manualId == null
        ? null
        : {
            placed: manualPlacement != null,
            seat: manualPlacement ? refOf(manualPlacement.key) : null,
            preferenceNo: manualPlacement?.preferenceNo ?? null,
            standings,
          },
    placed: placed.sort(byMark),
    upgraded: upgraded.sort(byMark),
    removed: removed.sort(byMark),
    stats: {
      waves: result.stats.waves,
      vacanciesOpened: result.stats.initialVacancies,
      totalPlacements: result.stats.totalPlacements,
      totalUpgrades: result.stats.totalUpgrades,
      seatsUnfilled: result.stats.finalUnfilled,
      overridesApplied,
    },
  };
}
