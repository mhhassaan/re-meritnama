/**
 * Cascade assertions, graded against what actually happened.
 *
 * Run with:  npm run test:cascade
 *
 * This suite has a real oracle, which is unusual and worth exploiting. The
 * published rounds give us round *n* as input and round *n+1* as the answer, so
 * a run can be **graded** rather than eyeballed. That matters more here than
 * anywhere else in the codebase: a subtly wrong cascade produces a full,
 * plausible-looking allocation, and there is no way to tell by reading it.
 *
 * Inputs live in `ingest/`, never `public/` — they carry per-candidate
 * preferences and contact details. The suite skips with a clear message rather
 * than failing if they are absent, since `ingest/` is gitignored.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.error(
      `  FAIL  ${name}\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function checkThat(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.error(`  FAIL  ${name}${detail ? "\n        " + detail : ""}`);
  }
}

const {
  runCascade,
  compareWithActual,
  buildPreferenceIndex,
  seatKeyOf,
  parseConsentTitle,
  consentSeatKey,
} = await import("./cascade.ts");

const INGEST = join(process.cwd(), "ingest", "induction21");
const PORTAL = join(INGEST, "portal");

const required = [
  join(INGEST, "induction21_candidates.json"),
  join(PORTAL, "ProfileStatus.json"),
  join(PORTAL, "induction21_merit_round1.json"),
  join(PORTAL, "induction21_merit_round2.json"),
  join(INGEST, "induction21_consent_round1.json"),
];

if (required.some((p) => !existsSync(p))) {
  console.log(
    "\nSKIP  cascade tests — ingest inputs not present.\n" +
      "      They are gitignored on purpose: they carry per-candidate\n" +
      "      preferences and contact details and must never be committed.\n"
  );
  process.exit(0);
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const rows = (raw) => (Array.isArray(raw) ? raw : (raw.data ?? Object.values(raw)[0]));

// ── Load ────────────────────────────────────────────────────────────────────

const candidatesRaw = readJson(join(INGEST, "induction21_candidates.json"));
const candidates = new Map();
for (const [id, c] of Object.entries(candidatesRaw)) {
  candidates.set(Number(id), c);
}

const seats = rows(readJson(join(process.cwd(), "public", "data", "induction21_seats.json")));

// specialityId to name. Preferences carry the id; seat rows carry the name, so
// nothing joins without this map.
const specialties = new Map();
for (const discipline of rows(
  readJson(join(process.cwd(), "public", "data", "disciplineFullData.json"))
)) {
  for (const s of discipline.specialities ?? []) {
    if (s.specialityId) specialties.set(s.specialityId, s.specialityName);
  }
}

// Certificates are optional — absent, every bonus is zero and the ranking falls
// back to the raw aggregate.
const certPath = join(PORTAL, "induction21_certificates.json");
const certificates = new Map();
if (existsSync(certPath)) {
  for (const [id, list] of Object.entries(readJson(certPath))) {
    certificates.set(Number(id), Array.isArray(list) ? list : Object.values(list ?? {}));
  }
}

// Verification status. Type 132 (Amendment Process) overrides type 131
// (Verification Round 01) where both exist — an amendment is the later ruling.
const profileRaw = readJson(join(PORTAL, "ProfileStatus.json"));
const status131 = new Map();
const status132 = new Map();
for (const e of profileRaw.entries ?? []) {
  (Number(e.statusTypeId) === 132 ? status132 : status131).set(
    Number(e.applicantId),
    Number(e.statusId)
  );
}
const profileStatus = (applicantId) =>
  status132.get(applicantId) ?? status131.get(applicantId) ?? null;

const meritRound = (n) => rows(readJson(join(PORTAL, `induction21_merit_round${n}.json`)));
const consentRound = (n) =>
  rows(readJson(join(INGEST, `induction21_consent_round${n}.json`)));

console.log(
  `\nloaded ${candidates.size} candidates, ${seats.length} seat rows, ` +
    `${specialties.size} specialties, ${certificates.size} certificate sets`
);

// ── Seat keys and consent titles ────────────────────────────────────────────
console.log("\nseat keys");

check(
  "a seat key is programme, specialty, hospital and quota",
  seatKeyOf({
    typeName: "FCPS",
    specialityName: "Anaesthesia",
    hospitalName: "Jinnah Hospital, Lahore",
    quotaName: " Punjab ",
  }),
  "FCPS|Anaesthesia|Jinnah Hospital, Lahore|Punjab"
);

// Five fields: the institute sits between specialty and hospital. Reading the
// fourth field would take the university as the hospital, and those rows then
// join to no seat at all.
check(
  "a five-field consent title reads the hospital as the LAST field",
  parseConsentTitle(
    "FCPS - Punjab - Ophthalmology - Faisalabad Medical University, Faisalabad - Allied II Hospital, Faisalabad"
  ).hospitalName,
  "Allied II Hospital, Faisalabad"
);
check(
  "a four-field title reads the same way",
  parseConsentTitle("FCPS - Punjab - Anaesthesia - Jinnah Hospital, Lahore").hospitalName,
  "Jinnah Hospital, Lahore"
);
check("a title with too few fields is rejected", parseConsentTitle("FCPS - Punjab"), null);
check(
  "an explicit seatKey wins over the title",
  consentSeatKey({ seatKey: "A|B|C|D", infoTitle: "X - Y - Z - W" }),
  "A|B|C|D"
);

const round1Consent = consentRound(1);
const unparseable = round1Consent.filter((r) => consentSeatKey(r) == null);
checkThat(
  "every round 1 consent row yields a seat key",
  unparseable.length === 0,
  `${unparseable.length} of ${round1Consent.length} failed`
);

// This is the assertion that caught the whitespace bug. Thirty-six rows joined
// to nothing before all four key fields were trimmed — 32 from trailing spaces
// on hospital and specialty names in the seats file, 4 from a trailing space on
// the "Armed Force " quota. Every one was a real acceptance dropped on the
// floor, so the tolerance here is zero rather than a small percentage.
const seatKeys = new Set(seats.map((s) => seatKeyOf(s)));
const orphanConsent = round1Consent.filter((r) => !seatKeys.has(consentSeatKey(r)));
check(
  "every consent seat key joins to a real seat",
  orphanConsent.length,
  0
);

// The same whitespace, from the other direction: a published merit row must
// also find its seat, or the cascade starts from an occupancy that is missing
// people who are actually sitting in those seats.
const orphanMerit = meritRound(1).filter((e) => !seatKeys.has(seatKeyOf(e)));
check("every published merit row joins to a real seat", orphanMerit.length, 0);

// ── The run ─────────────────────────────────────────────────────────────────
console.log("\ncascade, round 1 to round 2");

const preferenceIndex = buildPreferenceIndex(candidates, specialties, seats);

const result = runCascade({
  merit: meritRound(1),
  consent: round1Consent,
  seats,
  candidates,
  certificates,
  specialties,
  profileStatus,
});

console.log(
  `      waves ${result.stats.waves} · placed ${result.placements.length} · ` +
    `upgrades ${result.stats.totalUpgrades} · initial vacancies ${result.stats.initialVacancies} · ` +
    `unfilled ${result.stats.finalUnfilled}`
);

checkThat(
  "the cascade terminates well inside the guard",
  result.stats.waves > 0 && result.stats.waves < 100,
  `${result.stats.waves} waves`
);
checkThat(
  "rejections and awaited consents open vacancies",
  result.stats.initialVacancies > 0,
  `${result.stats.initialVacancies} seats vacated before the first wave`
);
checkThat(
  "the run produces placements",
  result.placements.length > 0,
  `${result.placements.length} placements`
);

// ── Invariants that must hold whatever the numbers say ──────────────────────
console.log("\ninvariants");

const capacityOf = new Map(seats.map((s) => [seatKeyOf(s), s.seats]));
const occupancy = new Map();
for (const p of result.placements) {
  const key = seatKeyOf(p);
  occupancy.set(key, (occupancy.get(key) ?? 0) + 1);
}
const overfilled = [...occupancy.entries()].filter(
  ([key, n]) => n > (capacityOf.get(key) ?? 0)
);
checkThat(
  "no seat is filled beyond its capacity",
  overfilled.length === 0,
  overfilled.slice(0, 3).map(([k, n]) => `${k} → ${n}/${capacityOf.get(k)}`).join(" | ")
);

const perCandidate = new Map();
for (const p of result.placements) {
  const list = perCandidate.get(p.applicantId) ?? [];
  list.push(p);
  perCandidate.set(p.applicantId, list);
}
const doubleInQuota = [...perCandidate.values()].filter((list) => {
  const scopes = list.map((p) => `${p.typeName}|${p.quotaName}`);
  return new Set(scopes).size !== scopes.length;
});
checkThat(
  "no candidate holds two seats in the same programme and quota",
  doubleInQuota.length === 0,
  `${doubleInQuota.length} candidates do`
);

// A rejected or still-awaited candidate must hold nothing. This is the single
// most important invariant: the whole point of the cascade is that their seats
// become available to someone else.
const heldByRejected = result.placements.filter(
  (p) => result.consentRejected.has(p.applicantId) || result.consentAwaited.has(p.applicantId)
);
checkThat(
  "nobody who rejected or is awaited still holds a seat",
  heldByRejected.length === 0,
  `${heldByRejected.length} placements held by rejected or awaited candidates`
);

const unverified = result.placements.filter((p) => profileStatus(p.applicantId) !== 1);
checkThat(
  "every placed candidate passed verification",
  unverified.length === 0,
  `${unverified.length} placements held by candidates whose status is not Accepted`
);

// Every placement must be a seat the candidate actually asked for.
const unrequested = result.placements.filter(
  (p) => preferenceIndex.get(p.applicantId)?.get(seatKeyOf(p)) == null
);
checkThat(
  "every placement is on a seat the candidate listed",
  unrequested.length === 0,
  `${unrequested.length} placements are on seats the candidate never listed`
);

// The bonus must be the one earned in a discipline the preference names — a
// negative bonus would mean the effective mark fell below the aggregate, which
// no rule permits.
const negativeBonus = result.placements.filter((p) => p.certBonus < 0);
checkThat(
  "no placement carries a negative certificate bonus",
  negativeBonus.length === 0,
  `${negativeBonus.length} do`
);

// ── Graded against the actual next round ────────────────────────────────────
console.log("\nagreement with the published round 2");

const comparison = compareWithActual(result.placements, meritRound(2), preferenceIndex);

console.log(
  `      ${comparison.sameSeat}/${comparison.common} same seat ` +
    `(${comparison.agreement.toFixed(1)}%) · sim better ${comparison.simBetter} · ` +
    `actual better ${comparison.actualBetter}`
);

checkThat(
  "the simulation and the published round 2 share most candidates",
  comparison.common > result.placements.length * 0.5,
  `${comparison.common} common of ${result.placements.length} simulated`
);

// The threshold is deliberately a floor, not a target. The cascade cannot be
// exact — PHF applies grievance outcomes and manual corrections between rounds
// that no published input describes — but a large drop means a rule broke, and
// that is what this catches.
checkThat(
  "agreement with the published round is at least 90%",
  comparison.agreement >= 90,
  `${comparison.agreement.toFixed(1)}% — investigate before adjusting this floor`
);

// ── The same grading, over every round pair we hold ─────────────────────────
//
// One pair proves very little: a rule can be wrong in a way that happens to
// agree on round 1. Every consecutive pair is graded, and each is asserted
// independently, so a regression that only shows up later in the cycle still
// fails the suite.
console.log("\nagreement across every round pair");

const agreements = [];

for (let n = 2; n <= 7; n++) {
  const inputMerit = join(PORTAL, `induction21_merit_round${n}.json`);
  const answerMerit = join(PORTAL, `induction21_merit_round${n + 1}.json`);
  const inputConsent = join(INGEST, `induction21_consent_round${n}.json`);
  if (![inputMerit, answerMerit, inputConsent].every((f) => existsSync(f))) continue;

  const run = runCascade({
    merit: meritRound(n),
    consent: consentRound(n),
    seats,
    candidates,
    certificates,
    specialties,
    profileStatus,
  });

  const graded = compareWithActual(run.placements, meritRound(n + 1), preferenceIndex);

  console.log(
    `      round ${n} to ${n + 1}: ${graded.sameSeat}/${graded.common} ` +
      `(${graded.agreement.toFixed(1)}%) · ${run.stats.waves} waves · ` +
      `${run.stats.totalUpgrades} upgrades`
  );

  agreements.push({ from: n, agreement: graded.agreement });

  // 88, not 90. The spread over real rounds is 89.4% to 94.7%, and the floor
  // has to sit under the genuine low or it is a tuned number rather than a
  // regression guard. What it catches is a rule breaking, which moves this by
  // tens of points, not by one.
  checkThat(
    `round ${n} to ${n + 1} agrees at least 88%`,
    graded.agreement >= 88,
    `${graded.agreement.toFixed(1)}%`
  );

  const overCapacity = (() => {
    const counts = new Map();
    for (const p of run.placements) {
      const key = seatKeyOf(p);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].filter(([key, c]) => c > (capacityOf.get(key) ?? 0));
  })();
  check(`round ${n} respects every seat capacity`, overCapacity.length, 0);
}

const mean =
  agreements.reduce((sum, a) => sum + a.agreement, 0) / (agreements.length || 1);
console.log(`      mean ${mean.toFixed(1)}% over ${agreements.length} pairs`);
checkThat(
  "mean agreement across all pairs is at least 91%",
  mean >= 91,
  `${mean.toFixed(1)}%`
);

// ── The one divergence we understand ────────────────────────────────────────
//
// Round 3 to 4 is the weakest pair, and the cause is specific rather than
// noise. An Awaited consent means the candidate has not answered yet, and the
// original's rule — kept here — releases their seat so it can cascade.
//
// PHF does that in most rounds but not in round 3:
//
//   round 2: 8 awaited,  0 kept their seat into the next round
//   round 3: 78 awaited, 67 kept their seat into the next round
//   round 4: 6 awaited,  0 kept their seat into the next round
//
// Round 3 evidently ran with an extension, so those candidates had not
// forfeited yet. Nothing in the published inputs says so, and inferring it
// would be guessing at PHF's internal process — so the rule stays as the
// original wrote it and this assertion records the consequence instead. If the
// number of retained seats changes, the model needs revisiting.
console.log("\nthe known divergence");

const round3Consent = consentRound(3);
const byCandidate = new Map();
for (const row of round3Consent) {
  const list = byCandidate.get(row.applicantId) ?? [];
  list.push(row);
  byCandidate.set(row.applicantId, list);
}
const round3Awaited = [...byCandidate.entries()].filter(([, rowsForCandidate]) =>
  rowsForCandidate.every((r) => r.status === "Awaited")
);

const round4Seats = new Map();
for (const entry of meritRound(4)) {
  const set = round4Seats.get(entry.applicantId) ?? new Set();
  set.add(seatKeyOf(entry));
  round4Seats.set(entry.applicantId, set);
}
const retained = round3Awaited.filter(([applicantId, rowsForCandidate]) => {
  const key = consentSeatKey(rowsForCandidate[0]);
  return key != null && round4Seats.get(Number(applicantId))?.has(key);
}).length;

console.log(
  `      round 3: ${round3Awaited.length} awaited, ${retained} kept their seat into round 4`
);
checkThat(
  "round 3's awaited candidates mostly kept their seats, which our rule releases",
  retained > round3Awaited.length * 0.5,
  `${retained} of ${round3Awaited.length} — if this has changed, revisit the Awaited rule`
);

// ── Determinism ─────────────────────────────────────────────────────────────
console.log("\ndeterminism");

const second = runCascade({
  merit: meritRound(1),
  consent: round1Consent,
  seats,
  candidates,
  certificates,
  specialties,
  profileStatus,
});
check(
  "two runs over identical input produce identical placements",
  second.placements.length === result.placements.length &&
    second.placements.every(
      (p, i) =>
        p.applicantId === result.placements[i].applicantId &&
        seatKeyOf(p) === seatKeyOf(result.placements[i])
    ),
  true
);
check("and identical statistics", second.stats, result.stats);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
