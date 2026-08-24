/**
 * The seat-allocation cascade.
 *
 * A port of the original's `sim-cascade.js`, which is itself a port of
 * `merit_cascade.py`. Pure and dependency-free (types only), so the node test
 * can import this exact module rather than a copy of it.
 *
 * ## What this is, and what it is not
 *
 * There are two different allocation algorithms in the original and they are
 * easy to confuse.
 *
 * `sim-placement.js` runs **deferred acceptance from a blank slate**: nobody
 * holds a seat, every candidate walks their preference list, and the highest
 * mark wins each contest. That answers "who would get what if allocation ran
 * today from scratch".
 *
 * This one does not start blank. It loads the **published merit list** as
 * initial occupancy, vacates the seats of everyone who rejected, is still
 * awaited, or failed verification, and then cascades the remaining candidates
 * upward into the holes that leaves. That answers the question candidates
 * actually ask between rounds: *given who has just declined, what moves?*
 *
 * ## Why upgrades are constrained the way they are
 *
 * Five constraints in here look arbitrary until you know what each one is
 * preventing. The original's header lists them as bug fixes; they are recorded
 * here because removing any of them produces output that still looks plausible.
 *
 * 1. **Real preference numbers.** A published merit entry is matched back to
 *    the candidate's own preference list to recover its preference number.
 *    Treating a missing one as 0 makes every published seat look like a first
 *    preference, so nobody can ever upgrade.
 * 2. **Beat-check only on full seats.** Displacing an occupant is only required
 *    when the seat has no room. Checking it on a seat with vacancies leaves
 *    seats empty that a candidate was entitled to.
 * 3. **Multi-track candidates are pinned to their consent quota.** Someone who
 *    appears under two quotas in the same programme has, by accepting, chosen
 *    one. Without this they keep competing under both.
 * 4. **Specialty-specific sorting.** Ranking uses the candidate's mark *for the
 *    specialty being filled*. A global sort lets a certificate bonus earned in
 *    an unrelated discipline inflate someone's position everywhere.
 * 5. **Per-quota seat holding for single-track candidates.** A candidate
 *    holding one seat in a quota is compared against seats in that same quota,
 *    not across the whole programme.
 *
 * ## Deviations from the original, deliberate
 *
 * - Synchronous. The original awaits a zero-delay timer each wave to let the
 *   browser paint. Progress is reported through `onWave` instead, so the engine
 *   has no opinion about where it runs.
 * - No `window` global, no DOM, no fetch. Inputs arrive as arguments.
 */

/** A seat is identified by all four of these and nothing else. */
export type SeatKeyParts = {
  typeName: string;
  specialityName: string;
  hospitalName: string;
  quotaName: string;
};

export type SeatCapacityRow = SeatKeyParts & { seats: number };

/** One row of a published merit list. */
export type MeritEntry = SeatKeyParts & {
  applicantId: number;
  nameFull?: string;
  marksTotal?: number;
  preferenceNo?: number;
};

export type ConsentStatus = "Accepted" | "Rejected" | "Awaited";

export type ConsentRow = {
  applicantId: number;
  status: ConsentStatus | string;
  preferenceNo: number;
  /**
   * `"FCPS - Punjab - Ophthalmology - <institute> - <hospital>"`.
   *
   * Four fields or five: the institute is present sometimes and absent others,
   * so the hospital is read as the LAST field rather than the fourth.
   */
  infoTitle?: string;
  /** Set directly for simulated rounds, where there is no title to parse. */
  seatKey?: string;
};

export type Preference = {
  specialityId: number;
  typeName: string;
  typeId: number;
  hospitalName: string;
  quotaName: string;
  preferenceNo: number;
  disciplineIds?: number[];
};

export type Candidate = {
  applicantId: number;
  nameFull?: string;
  marksTotal?: number;
  preferences?: Preference[];
};

export type Certificate = {
  typeId: number;
  disciplineId: number;
  certificateMarks?: number;
  computerizedMarks?: number;
};

/**
 * Verification outcome for a candidate.
 *
 * 1 = Accepted, 2 = Rejected, 11 = Pending, null = no record. Only 1 keeps a
 * seat: an unverified candidate is not eligible, and a candidate with no record
 * at all is treated as unknown rather than accepted.
 */
export type ProfileStatusFn = (applicantId: number) => number | null;

export type Placement = SeatKeyParts & {
  applicantId: number;
  nameFull: string;
  preferenceNo: number;
  /** The candidate's own aggregate, before any certificate bonus. */
  marksTotal: number;
  /** Aggregate plus the best certificate bonus applicable to THIS seat. */
  effectiveMark: number;
  certBonus: number;
};

export type CascadeStats = {
  waves: number;
  totalPlacements: number;
  totalUpgrades: number;
  initialVacancies: number;
  finalUnfilled: number;
  initialPublishedCandidates: number;
  initialPublishedOccupancy: number;
  multiProgram: number;
  multiTrack: number;
  locked: number;
};

export type CascadeResult = {
  placements: Placement[];
  stats: CascadeStats;
  consentRejected: Set<number>;
  consentAwaited: Set<number>;
};

export type CascadeInput = {
  merit: MeritEntry[];
  consent: ConsentRow[];
  seats: SeatCapacityRow[];
  candidates: Map<number, Candidate>;
  certificates: Map<number, Certificate[]>;
  /** `specialityId` to name. Preferences carry the id; seats carry the name. */
  specialties: Map<number, string>;
  profileStatus: ProfileStatusFn;
  /** Candidates who rejected in an earlier simulated round. */
  carriedRejections?: Set<number>;
  onWave?: (progress: {
    wave: number;
    changes: number;
    totalPlacements: number;
    totalUpgrades: number;
  }) => void;
};

/**
 * Specialty ids absent from the discipline file but present in preferences.
 *
 * Carried over verbatim, spellings included — "Rehablitation" is how the PHF
 * portal writes it, and correcting it here would stop the name matching the
 * seat rows it has to join against.
 */
const MISSING_SPECIALTY_IDS: Record<number, string> = {
  63: "Physical Medicine & Rehablitation",
  69: "Nuclear Medicine",
  70: "Immunology",
  71: "Virology",
};

/** Runaway guard. The cascade converges in single digits on real data. */
const MAX_WAVES = 100;

/**
 * All four fields are trimmed, not just the quota.
 *
 * The original trims only `quotaName`, and that costs it real rows. The seats
 * file carries trailing spaces on hospital names ("Nishtar-II Hospital Multan ")
 * and on specialties ("Radiation Oncology "), while a consent title arrives
 * already trimmed because it was split on " - ". Thirty-two of round 1's
 * consent rows therefore joined to no seat at all, and each one is a real
 * doctor whose acceptance was silently dropped from the cascade.
 *
 * Spelling is left exactly as published — "Warzirabad" and "intitute" are how
 * the PHF portal writes them, and correcting either would stop the value
 * matching the seat rows it has to join against.
 */
export function seatKeyOf(parts: SeatKeyParts): string {
  return seatKeyFromParts(
    parts.typeName,
    parts.specialityName,
    parts.hospitalName,
    parts.quotaName
  );
}

function seatKeyFromParts(
  typeName: string,
  specialityName: string,
  hospitalName: string,
  quotaName: string
): string {
  const t = (v: string) => (v ?? "").trim();
  return `${t(typeName)}|${t(specialityName)}|${t(hospitalName)}|${t(quotaName)}`;
}

/**
 * Splits a consent row's title back into its four seat fields.
 *
 * The hospital is the LAST field, not the fourth: some titles carry an
 * institute between specialty and hospital and some do not, so a fixed index
 * silently reads the university as the hospital for a subset of rows — and
 * those rows then join to no seat at all.
 */
export function parseConsentTitle(title: string): SeatKeyParts | null {
  const parts = String(title ?? "")
    .split(" - ")
    .map((p) => p.trim());
  if (parts.length < 4) return null;
  return {
    typeName: parts[0],
    quotaName: parts[1],
    specialityName: parts[2],
    hospitalName: parts[parts.length - 1],
  };
}

export function consentSeatKey(row: ConsentRow): string | null {
  if (row.seatKey) return row.seatKey;
  const parsed = parseConsentTitle(row.infoTitle ?? "");
  return parsed ? seatKeyOf(parsed) : null;
}

export function runCascade(input: CascadeInput): CascadeResult {
  const {
    merit,
    consent,
    seats: seatRows,
    candidates,
    certificates,
    specialties,
    profileStatus,
    carriedRejections,
    onWave,
  } = input;

  const specialtyName = (id: number): string | undefined =>
    specialties.get(id) ?? MISSING_SPECIALTY_IDS[id];

  // ── Seat capacity ────────────────────────────────────────────────────────
  const capacity = new Map<string, number>();
  for (const row of seatRows) capacity.set(seatKeyOf(row), row.seats);

  // ── Certificate bonus, keyed by programme and discipline ─────────────────
  // Highest bonus wins where a candidate holds more than one certificate for
  // the same pair.
  const certBonus = new Map<number, Map<string, number>>();
  for (const [applicantId, certs] of certificates) {
    const bonuses = new Map<string, number>();
    for (const cert of certs) {
      const bonus = cert.certificateMarks ?? cert.computerizedMarks ?? 0;
      const key = `${cert.typeId}_${cert.disciplineId}`;
      if (bonus > (bonuses.get(key) ?? -Infinity)) bonuses.set(key, bonus);
    }
    certBonus.set(applicantId, bonuses);
  }

  // ── Effective mark per candidate per seat ────────────────────────────────
  // Constraint 4 lives here: the bonus applied is the one earned in a
  // discipline this preference actually names, so an unrelated certificate
  // cannot lift a candidate in a specialty it has nothing to do with.
  const effMarkForSeat = new Map<number, Map<string, number>>();
  const preferenceOf = new Map<number, Map<string, number>>();
  const programsOf = new Map<number, Set<string>>();

  for (const [applicantId, candidate] of candidates) {
    const base = candidate.marksTotal ?? 0;
    const marks = new Map<string, number>();
    const prefs = new Map<string, number>();
    const programs = new Set<string>();

    for (const pref of candidate.preferences ?? []) {
      const specName = specialtyName(pref.specialityId);
      if (!specName) continue;
      const key = seatKeyFromParts(
        pref.typeName,
        specName,
        pref.hospitalName,
        pref.quotaName
      );
      if (!capacity.has(key)) continue;

      let bonus = 0;
      for (const disciplineId of pref.disciplineIds ?? []) {
        const b = certBonus.get(applicantId)?.get(`${pref.typeId}_${disciplineId}`) ?? 0;
        if (b > bonus) bonus = b;
      }
      marks.set(key, base + bonus);
      prefs.set(key, pref.preferenceNo);
      programs.add(pref.typeName);
    }

    if (marks.size) effMarkForSeat.set(applicantId, marks);
    preferenceOf.set(applicantId, prefs);
    programsOf.set(applicantId, programs);
  }

  const effectiveMark = (applicantId: number, key: string): number =>
    effMarkForSeat.get(applicantId)?.get(key) ??
    candidates.get(applicantId)?.marksTotal ??
    0;

  // ── Consent ──────────────────────────────────────────────────────────────
  const byCandidate = new Map<number, ConsentRow[]>();
  for (const row of consent) {
    const list = byCandidate.get(row.applicantId);
    if (list) list.push(row);
    else byCandidate.set(row.applicantId, [row]);
  }

  const consentApproved = new Map<number, ConsentRow>();
  const consentRejected = new Set<number>();
  const consentAwaited = new Set<number>();

  for (const [applicantId, rows] of byCandidate) {
    const accepted = rows.filter((r) => r.status === "Accepted");
    if (accepted.length) {
      // Best preference among the accepted rows — a candidate can appear
      // accepted at more than one seat, and only the best one binds.
      accepted.sort((a, b) => a.preferenceNo - b.preferenceNo);
      consentApproved.set(applicantId, accepted[0]);
    }
    if (rows.every((r) => r.status === "Rejected")) consentRejected.add(applicantId);
    if (rows.every((r) => r.status === "Awaited")) consentAwaited.add(applicantId);
  }

  for (const applicantId of carriedRejections ?? []) consentRejected.add(applicantId);

  const isEligible = (applicantId: number): boolean => {
    if (profileStatus(applicantId) !== 1) return false;
    return !consentRejected.has(applicantId) && !consentAwaited.has(applicantId);
  };

  // ── Initial occupancy, from the published list ───────────────────────────
  const seats = new Map<string, { capacity: number; occupants: Map<number, number> }>();
  for (const [key, cap] of capacity) {
    seats.set(key, { capacity: cap, occupants: new Map() });
  }

  /** applicantId to the seats they currently hold, and at what preference. */
  const held = new Map<number, Map<string, number>>();
  const publishedPrograms = new Map<number, Set<string>>();
  const publishedQuotas = new Map<number, Map<string, Set<string>>>();
  const publishedCandidates = new Set<number>();
  let publishedOccupancy = 0;

  for (const entry of merit) {
    const applicantId = entry.applicantId;
    const key = seatKeyOf(entry);

    // Constraint 1: the preference number comes from the candidate's own list,
    // not from the merit row. A default of 0 would make every published seat
    // look like a first preference and freeze the cascade.
    const prefNo = preferenceOf.get(applicantId)?.get(key) ?? 0;

    const seat = seats.get(key);
    if (seat) {
      seat.occupants.set(applicantId, prefNo);
      const mine = held.get(applicantId) ?? new Map<string, number>();
      mine.set(key, prefNo);
      held.set(applicantId, mine);
    }

    publishedCandidates.add(applicantId);
    publishedOccupancy++;

    const programs = publishedPrograms.get(applicantId) ?? new Set<string>();
    programs.add(entry.typeName);
    publishedPrograms.set(applicantId, programs);

    const quotas = publishedQuotas.get(applicantId) ?? new Map<string, Set<string>>();
    const forType = quotas.get(entry.typeName) ?? new Set<string>();
    forType.add((entry.quotaName ?? "").trim());
    quotas.set(entry.typeName, forType);
    publishedQuotas.set(applicantId, quotas);
  }

  const multiProgram = new Set<number>();
  for (const [applicantId, programs] of publishedPrograms) {
    if (programs.size > 1) multiProgram.add(applicantId);
  }

  /** applicantId to the programmes in which they hold seats under 2+ quotas. */
  const multiTrackInType = new Map<number, Set<string>>();
  for (const [applicantId, byType] of publishedQuotas) {
    for (const [typeName, quotas] of byType) {
      if (quotas.size <= 1) continue;
      const set = multiTrackInType.get(applicantId) ?? new Set<string>();
      set.add(typeName);
      multiTrackInType.set(applicantId, set);
    }
  }

  // ── Vacate ───────────────────────────────────────────────────────────────
  const vacantQueue: string[] = [];

  function vacate(applicantId: number, key: string): void {
    const seat = seats.get(key);
    if (seat?.occupants.has(applicantId)) {
      seat.occupants.delete(applicantId);
      held.get(applicantId)?.delete(key);
      vacantQueue.push(key);
    }
  }

  function vacateAll(applicantId: number): void {
    for (const key of [...(held.get(applicantId)?.keys() ?? [])]) {
      vacate(applicantId, key);
    }
  }

  for (const applicantId of [...held.keys()]) {
    // Failed or pending verification releases everything. Note the null check:
    // a candidate with no verification record at all is left alone here, and is
    // caught later by `isEligible` when they try to take a new seat.
    const status = profileStatus(applicantId);
    if (status != null && status !== 1) {
      vacateAll(applicantId);
      continue;
    }

    if (consentRejected.has(applicantId) || consentAwaited.has(applicantId)) {
      vacateAll(applicantId);
      continue;
    }

    const approved = consentApproved.get(applicantId);
    if (!approved) continue;

    const acceptedKey = consentSeatKey(approved);
    if (!acceptedKey) continue;

    // Accepting one seat releases every other seat the candidate held.
    for (const key of [...(held.get(applicantId)?.keys() ?? [])]) {
      if (key !== acceptedKey) vacate(applicantId, key);
    }

    // And puts them on the accepted seat if the published list did not.
    const seat = seats.get(acceptedKey);
    if (seat && !seat.occupants.has(applicantId) && seat.occupants.size < seat.capacity) {
      const prefNo = preferenceOf.get(applicantId)?.get(acceptedKey) ?? 999;
      seat.occupants.set(applicantId, prefNo);
      const mine = held.get(applicantId) ?? new Map<string, number>();
      mine.set(acceptedKey, prefNo);
      held.set(applicantId, mine);
    }
  }

  // ── What each candidate is still allowed to compete for ──────────────────
  const allowedPrograms = new Map<number, Set<string>>();
  for (const applicantId of [...held.keys()]) {
    const approved = consentApproved.get(applicantId);
    const acceptedKey = approved ? consentSeatKey(approved) : null;

    if (acceptedKey) {
      const consentProgram = acceptedKey.split("|")[0];
      // Someone published under two programmes who accepts in one has chosen
      // that programme; someone published under a single programme keeps it.
      allowedPrograms.set(
        applicantId,
        multiProgram.has(applicantId)
          ? new Set([consentProgram])
          : (publishedPrograms.get(applicantId) ?? new Set([consentProgram]))
      );
    } else {
      allowedPrograms.set(applicantId, publishedPrograms.get(applicantId) ?? new Set());
    }
  }

  // Constraint 3.
  const allowedQuotas = new Map<number, Set<string>>();
  for (const [applicantId, types] of multiTrackInType) {
    const approved = consentApproved.get(applicantId);
    const acceptedKey = approved ? consentSeatKey(approved) : null;
    if (!acceptedKey) continue;

    const [consentType, , , consentQuota] = acceptedKey.split("|");
    if (!types.has(consentType)) continue;

    allowedQuotas.set(applicantId, new Set([consentQuota]));
    if (!allowedPrograms.get(applicantId)?.has(consentType)) {
      allowedPrograms.set(applicantId, new Set([consentType]));
    }
  }

  /**
   * Accepted at their own first preference — there is nothing better to move to
   * within the programme, so they only stay put across programmes.
   */
  const locked = new Set<number>();
  for (const [applicantId, approved] of consentApproved) {
    const acceptedKey = consentSeatKey(approved);
    if (!acceptedKey) continue;
    if (held.get(applicantId)?.get(acceptedKey) == null) continue;
    if (preferenceOf.get(applicantId)?.get(acceptedKey) === 1) locked.add(applicantId);
  }

  const initialVacancies = vacantQueue.length;

  function canTakeSeat(applicantId: number, key: string): boolean {
    if (!preferenceOf.get(applicantId)?.has(key)) return false;

    const [program, , , quota] = key.split("|");

    const programs = allowedPrograms.get(applicantId);
    if (programs && programs.size > 0 && !programs.has(program)) return false;

    const quotas = allowedQuotas.get(applicantId);
    if (quotas && !quotas.has(quota)) return false;

    return true;
  }

  /** Constraint 5: the scope a held seat is compared against. */
  function heldInScope(applicantId: number, program: string, quota: string) {
    const mine = held.get(applicantId);
    if (!mine) return [] as Array<[string, number]>;

    const wholeProgram = multiTrackInType.get(applicantId)?.has(program) ?? false;
    const out: Array<[string, number]> = [];
    for (const [key, prefNo] of mine) {
      const parts = key.split("|");
      if (parts[0] !== program) continue;
      if (!wholeProgram && parts[3] !== quota) continue;
      out.push([key, prefNo]);
    }
    return out;
  }

  // ── Candidate order, per programme and specialty ─────────────────────────
  // Constraint 4 again: one ranking per (programme, specialty), built from each
  // candidate's best mark within that specialty.
  const bestBySpecialty = new Map<string, Map<number, number>>();
  for (const [applicantId, marks] of effMarkForSeat) {
    for (const [key, mark] of marks) {
      const parts = key.split("|");
      const specKey = `${parts[0]}|${parts[1]}`;
      const forSpec = bestBySpecialty.get(specKey) ?? new Map<number, number>();
      if (mark > (forSpec.get(applicantId) ?? -Infinity)) forSpec.set(applicantId, mark);
      bestBySpecialty.set(specKey, forSpec);
    }
  }

  const allApplicantIds = [...candidates.keys()];
  const orderBySpecialty = new Map<string, number[]>();
  for (const [specKey, marks] of bestBySpecialty) {
    orderBySpecialty.set(
      specKey,
      [...allApplicantIds].sort((a, b) => {
        const diff = (marks.get(b) ?? 0) - (marks.get(a) ?? 0);
        // Applicant id breaks ties, so a run is reproducible rather than
        // depending on map insertion order.
        return diff !== 0 ? diff : a - b;
      })
    );
  }

  // ── Cascade ──────────────────────────────────────────────────────────────
  let wave = 0;
  let totalPlacements = 0;
  let totalUpgrades = 0;

  for (;;) {
    wave++;
    let changes = 0;

    const vacant = [...new Set(vacantQueue)];
    vacantQueue.length = 0;

    for (const key of vacant) {
      const seat = seats.get(key);
      if (!seat || seat.occupants.size >= seat.capacity) continue;

      const parts = key.split("|");
      const program = parts[0];
      const quota = parts[3];
      const order = orderBySpecialty.get(`${parts[0]}|${parts[1]}`) ?? allApplicantIds;

      const vacancies = seat.capacity - seat.occupants.size;

      for (let v = 0; v < vacancies; v++) {
        let filled = false;

        for (const applicantId of order) {
          if (!isEligible(applicantId)) continue;
          if (!canTakeSeat(applicantId, key)) continue;
          if (seat.occupants.has(applicantId)) continue;

          const newPref = preferenceOf.get(applicantId)?.get(key);
          if (newPref == null) continue;

          const scope = heldInScope(applicantId, program, quota);

          // Holding nothing in scope: straight placement, no contest.
          if (!scope.length) {
            seat.occupants.set(applicantId, newPref);
            const mine = held.get(applicantId) ?? new Map<string, number>();
            mine.set(key, newPref);
            held.set(applicantId, mine);
            totalPlacements++;
            changes++;
            filled = true;
            break;
          }

          const bestHeld = Math.min(...scope.map(([, prefNo]) => prefNo));

          // Locked candidates may still improve within their own programme,
          // but never move to a different one.
          if (locked.has(applicantId)) {
            const approved = consentApproved.get(applicantId);
            const acceptedKey = approved ? consentSeatKey(approved) : null;
            if (acceptedKey && program !== acceptedKey.split("|")[0]) continue;
          }

          // Only an improvement is worth taking. Equal or worse leaves them.
          if (newPref >= bestHeld) continue;

          // Constraint 2: displacement is only in play on a full seat.
          if (seat.occupants.size >= seat.capacity) {
            let lowestMark = Infinity;
            for (const occupant of seat.occupants.keys()) {
              const mark = effectiveMark(occupant, key);
              if (mark < lowestMark) lowestMark = mark;
            }
            if (effectiveMark(applicantId, key) <= lowestMark) continue;
          }

          for (const [oldKey] of scope) {
            const oldSeat = seats.get(oldKey);
            if (oldSeat?.occupants.has(applicantId)) {
              oldSeat.occupants.delete(applicantId);
              held.get(applicantId)?.delete(oldKey);
              if (!vacantQueue.includes(oldKey)) vacantQueue.push(oldKey);
            }
          }

          seat.occupants.set(applicantId, newPref);
          const mine = held.get(applicantId) ?? new Map<string, number>();
          mine.set(key, newPref);
          held.set(applicantId, mine);
          totalPlacements++;
          totalUpgrades++;
          changes++;
          filled = true;
          break;
        }

        // Nobody could take this vacancy, so nobody can take the next one
        // either — the candidate order is the same.
        if (!filled) break;
      }
    }

    if (changes === 0) break;
    if (wave > MAX_WAVES) break;

    onWave?.({ wave, changes, totalPlacements, totalUpgrades });
  }

  // ── Result ───────────────────────────────────────────────────────────────
  const placements: Placement[] = [];
  let finalUnfilled = 0;

  for (const [key, seat] of seats) {
    const [typeName, specialityName, hospitalName, quotaName] = key.split("|");

    for (const [applicantId, preferenceNo] of seat.occupants) {
      const effective = effectiveMark(applicantId, key);
      const base = candidates.get(applicantId)?.marksTotal ?? 0;
      placements.push({
        applicantId,
        typeName,
        specialityName,
        hospitalName,
        quotaName,
        preferenceNo,
        marksTotal: base,
        effectiveMark: effective,
        certBonus: Math.round((effective - base) * 10000) / 10000,
        nameFull: candidates.get(applicantId)?.nameFull ?? "",
      });
    }

    if (seat.occupants.size < seat.capacity) {
      finalUnfilled += seat.capacity - seat.occupants.size;
    }
  }

  placements.sort(
    (a, b) => b.marksTotal - a.marksTotal || a.applicantId - b.applicantId
  );

  return {
    placements,
    stats: {
      waves: wave,
      totalPlacements,
      totalUpgrades,
      initialVacancies,
      finalUnfilled,
      initialPublishedCandidates: publishedCandidates.size,
      initialPublishedOccupancy: publishedOccupancy,
      multiProgram: multiProgram.size,
      multiTrack: multiTrackInType.size,
      locked: locked.size,
    },
    consentRejected: new Set(consentRejected),
    consentAwaited: new Set(consentAwaited),
  };
}

export type CascadeComparison = {
  /** Candidates present in both the simulation and the actual next round. */
  common: number;
  sameSeat: number;
  simBetter: number;
  actualBetter: number;
  /** `sameSeat / common`, as a percentage. */
  agreement: number;
  mismatches: Array<{
    applicantId: number;
    simulated: string;
    actual: string;
    simulatedPref: number;
    actualPref: number;
  }>;
};

/**
 * Scores a cascade run against what actually happened.
 *
 * This is the oracle. The published rounds give us round *n* as input and round
 * *n+1* as the answer, so a run can be graded rather than eyeballed — which
 * matters, because a subtly wrong cascade produces output that looks entirely
 * reasonable.
 *
 * A candidate holding several rows in the actual list is counted at their first
 * one, matching the original.
 */
export function compareWithActual(
  simulated: Placement[],
  actual: MeritEntry[],
  preferenceOf: Map<number, Map<string, number>>
): CascadeComparison {
  const simMap = new Map<number, { key: string; prefNo: number }>();
  for (const p of simulated) {
    simMap.set(p.applicantId, { key: seatKeyOf(p), prefNo: p.preferenceNo });
  }

  const actualMap = new Map<number, { key: string }>();
  for (const entry of actual) {
    if (actualMap.has(entry.applicantId)) continue;
    actualMap.set(entry.applicantId, { key: seatKeyOf(entry) });
  }

  let common = 0;
  let sameSeat = 0;
  let simBetter = 0;
  let actualBetter = 0;
  const mismatches: CascadeComparison["mismatches"] = [];

  for (const [applicantId, sim] of simMap) {
    const act = actualMap.get(applicantId);
    if (!act) continue;
    common++;

    if (sim.key === act.key) {
      sameSeat++;
      continue;
    }

    const actualPref = preferenceOf.get(applicantId)?.get(act.key) ?? 999;
    if (sim.prefNo < actualPref) simBetter++;
    else actualBetter++;

    mismatches.push({
      applicantId,
      simulated: sim.key,
      actual: act.key,
      simulatedPref: sim.prefNo,
      actualPref,
    });
  }

  return {
    common,
    sameSeat,
    simBetter,
    actualBetter,
    agreement: common ? (sameSeat / common) * 100 : 0,
    mismatches,
  };
}

/**
 * The preference index, exposed so a caller can grade a run.
 *
 * `compareWithActual` needs to know what preference number the actual seat was
 * for each candidate, which only the preference list knows.
 */
export function buildPreferenceIndex(
  candidates: Map<number, Candidate>,
  specialties: Map<number, string>,
  seatRows: SeatCapacityRow[]
): Map<number, Map<string, number>> {
  const capacity = new Set(seatRows.map((r) => seatKeyOf(r)));
  const out = new Map<number, Map<string, number>>();

  for (const [applicantId, candidate] of candidates) {
    const prefs = new Map<string, number>();
    for (const pref of candidate.preferences ?? []) {
      const specName = specialties.get(pref.specialityId) ?? MISSING_SPECIALTY_IDS[pref.specialityId];
      if (!specName) continue;
      const key = seatKeyFromParts(
        pref.typeName,
        specName,
        pref.hospitalName,
        pref.quotaName
      );
      if (capacity.has(key)) prefs.set(key, pref.preferenceNo);
    }
    out.set(applicantId, prefs);
  }

  return out;
}
