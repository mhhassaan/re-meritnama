/**
 * The manually-added candidate.
 *
 * Someone who is not in the published merit lists — because they have not
 * placed in any round — cannot find themselves in the portal at all. The
 * original's answer is "add me manually": enter your marks and your preference
 * list, and the simulation treats you as a competitor.
 *
 * ## It lives in the browser and nowhere else
 *
 * This is never written to the database. Two reasons, and the second is the
 * one that matters:
 *
 * 1. The original promises exactly this ("this data stays in your browser
 *    only"), and it is the right promise.
 * 2. Nothing verifies it. A form anyone can type into is not evidence of
 *    anything, and a table of self-asserted marks sitting next to the ingested
 *    gazette would be indistinguishable from it a month later. Keeping it
 *    client-side means an unverified claim can never be mistaken for a
 *    published fact.
 *
 * It is sent to the server only as an argument when running a simulation, used
 * for that one run, and discarded. Nothing persists server-side.
 *
 * Pure and dependency-free so it can be unit-tested directly.
 */

export type ManualPreference = {
  preference_no: number;
  program: string;
  quota: string;
  specialty: string;
  hospital: string;
};

export type ManualCandidate = {
  applicantId: number;
  name: string;
  /** Aggregate marks, on the cycle's own scale. */
  marksTotal: number;
  preferences: ManualPreference[];
};

export const STORAGE_KEY = "mn_portal_manual_candidate";

/**
 * Applicant ids for manual entries start here.
 *
 * Real ids for Induction 21 run 2255–39524. Starting well above that means a
 * manual candidate can never collide with a real one, so the engine cannot
 * silently merge an invented person with a published one — the same separation
 * the synthetic fixtures use at 900001.
 */
export const MANUAL_ID_BASE = 990001;

export type ValidationResult = { ok: true; value: ManualCandidate } | { ok: false; errors: string[] };

export function validate(input: {
  name: string;
  marksTotal: string;
  preferences: ManualPreference[];
  applicantId?: number;
}): ValidationResult {
  const errors: string[] = [];

  const name = input.name.trim();
  if (!name) errors.push("Enter a name.");

  const marks = Number(input.marksTotal);
  if (!Number.isFinite(marks) || marks <= 0) {
    errors.push("Enter your aggregate marks as a number.");
  } else if (marks > 100) {
    // The cycle's total is 30; anything near 100 is a percentage typed into a
    // marks field, which would place the candidate above every real applicant.
    errors.push("Marks look like a percentage. Enter the aggregate on the cycle's own scale.");
  }

  const complete = input.preferences.filter(
    (p) => p.program && p.quota && p.specialty && p.hospital
  );
  if (!complete.length) errors.push("Add at least one preference.");

  const seen = new Set<string>();
  for (const pref of complete) {
    const key = `${pref.program}|${pref.specialty}|${pref.hospital}|${pref.quota}`;
    if (seen.has(key)) {
      errors.push("The same seat is listed more than once.");
      break;
    }
    seen.add(key);
  }

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      applicantId: input.applicantId ?? MANUAL_ID_BASE,
      name,
      marksTotal: marks,
      // Renumbered from 1 in the order given, so the engine reads the list the
      // reader actually sees rather than whatever gaps editing left behind.
      preferences: complete.map((pref, i) => ({ ...pref, preference_no: i + 1 })),
    },
  };
}

export function load(): ManualCandidate | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ManualCandidate;
    if (!parsed?.applicantId || !Array.isArray(parsed.preferences)) return null;
    return parsed;
  } catch {
    // A corrupt entry is not worth surfacing — it is a local scratchpad.
    return null;
  }
}

export function save(candidate: ManualCandidate): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(candidate));
  window.dispatchEvent(new Event("mn-manual-changed"));
}

export function clear(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("mn-manual-changed"));
}
