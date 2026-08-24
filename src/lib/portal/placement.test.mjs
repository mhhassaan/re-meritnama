/**
 * Blank-slate allocation assertions.
 *
 * Run with:  npm run test:placement
 *
 * Two kinds of check. The first are invariants that must hold whatever the
 * numbers say — no seat over capacity, nobody placed on a seat they did not
 * ask for, no candidate holding two seats in one track. Those are cheap and
 * they catch the mistakes that produce a full, plausible-looking allocation.
 *
 * The second is an oracle. Round 1 of a cycle is the closest thing the
 * published data has to an allocation run from scratch: nobody held a seat
 * before it, so the same algorithm should land in roughly the same place.
 * Roughly, not exactly — PHF's round 1 already reflects eligibility rulings and
 * corrections that no published input describes.
 *
 * Inputs live in `ingest/`, never `public/`. The suite skips rather than fails
 * when they are absent, since `ingest/` is gitignored.
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

const { runPlacement, quotaTrack } = await import("./placement.ts");

const INGEST = join(process.cwd(), "ingest", "induction21");
const PORTAL = join(INGEST, "portal");
const DATA = join(process.cwd(), "public", "data");

const required = [
  join(INGEST, "induction21_candidates.json"),
  join(PORTAL, "induction21_merit_round1.json"),
  join(DATA, "induction21_seats.json"),
];

// ── Quota tracks work without any data ──────────────────────────────────────
console.log("\nquota tracks");

check("Armed Force is its own track", quotaTrack("Armed Force"), "armed");
check("trailing whitespace does not change the track", quotaTrack("Armed Force "), "armed");
check("punctuation does not either", quotaTrack("Armed-Forces"), "armed");
check("Punjab is civilian", quotaTrack("Punjab"), "civilian");
// The rule tests the armed case rather than listing civilian quotas, so a quota
// nobody anticipated still competes instead of silently vanishing.
check("an unrecognised quota competes as civilian", quotaTrack("Balochistan"), "civilian");
check("an empty quota still competes", quotaTrack(""), "civilian");

// ── A tiny hand-built case, where the right answer is obvious ───────────────
console.log("\na case small enough to check by hand");
{
  const seats = [
    { program: "FCPS", quota: "Punjab", specialty: "Surgery", hospital: "A", seats: 1 },
    { program: "FCPS", quota: "Punjab", specialty: "Surgery", hospital: "B", seats: 1 },
  ];
  const pref = (n, hospital) => ({
    preference_no: n,
    program: "FCPS",
    quota: "Punjab",
    specialty: "Surgery",
    hospital,
  });

  // Both want A first. The stronger one takes it; the other falls to B.
  const marks = { 1: 90, 2: 80 };
  const result = runPlacement({
    program: "FCPS",
    seats,
    candidates: [
      { applicantId: 1, nameFull: "Stronger", preferences: [pref(1, "A"), pref(2, "B")] },
      { applicantId: 2, nameFull: "Weaker", preferences: [pref(1, "A"), pref(2, "B")] },
    ],
    effectiveMark: (id) => marks[id],
  });

  const slotA = result.slots.find((s) => s.hospital === "A");
  const slotB = result.slots.find((s) => s.hospital === "B");

  check("the stronger candidate takes the contested seat", slotA.placed[0].applicantId, 1);
  check("the weaker one falls to their second preference", slotB.placed[0].applicantId, 2);
  check("a full slot reports a cutoff", slotA.cutoff, 90);

  // The loser of A is placed at B, which they wanted LESS. So they are still a
  // genuine contender for A, and must be next in line rather than faded out.
  check("the displaced candidate is next in line for the seat they lost", slotA.nextInLine?.applicantId, 2);
  check("everyone is placed", result.stats.unplaced, 0);

  // Now the same contest with one seat removed: somebody must go unplaced, and
  // the empty slot must NOT report a cutoff.
  const scarce = runPlacement({
    program: "FCPS",
    seats: [seats[0]],
    candidates: [
      { applicantId: 1, nameFull: "Stronger", preferences: [pref(1, "A")] },
      { applicantId: 2, nameFull: "Weaker", preferences: [pref(1, "A")] },
    ],
    effectiveMark: (id) => marks[id],
  });
  check("the weaker candidate goes unplaced", scarce.stats.unplaced, 1);

  const empty = runPlacement({
    program: "FCPS",
    seats,
    candidates: [{ applicantId: 1, nameFull: "Only", preferences: [pref(1, "A")] }],
    effectiveMark: () => 50,
  });
  check(
    "an unfilled slot reports no cutoff rather than a false one",
    empty.slots.find((s) => s.hospital === "B").cutoff,
    null
  );

  // A tie must not loop. The incumbent keeps the seat.
  const tied = runPlacement({
    program: "FCPS",
    seats: [seats[0]],
    candidates: [
      { applicantId: 1, nameFull: "One", preferences: [pref(1, "A")] },
      { applicantId: 2, nameFull: "Two", preferences: [pref(1, "A")] },
    ],
    effectiveMark: () => 75,
  });
  check("a tie resolves rather than looping", tied.stats.placed, 1);
  checkThat(
    "and it converges in a couple of passes",
    tied.stats.passes <= 3,
    `${tied.stats.passes} passes`
  );

  // Armed and civilian are separate competitions. One candidate holding
  // preferences in both is in both, and may win a seat in each.
  const bothTracks = runPlacement({
    program: "FCPS",
    seats: [
      seats[0],
      { program: "FCPS", quota: "Armed Force", specialty: "Surgery", hospital: "A", seats: 1 },
    ],
    candidates: [
      {
        applicantId: 1,
        nameFull: "Dual",
        preferences: [
          pref(1, "A"),
          { preference_no: 2, program: "FCPS", quota: "Armed Force", specialty: "Surgery", hospital: "A" },
        ],
      },
    ],
    effectiveMark: () => 70,
  });
  check("a candidate in both tracks competes twice", bothTracks.stats.competitors, 2);
  check("and can hold a seat in each", bothTracks.stats.placed, 2);
}

if (required.some((p) => !existsSync(p))) {
  console.log(
    "\nSKIP  the real-data run — ingest inputs not present.\n" +
      "      They are gitignored on purpose: they carry per-candidate\n" +
      "      preferences and contact details and must never be committed.\n"
  );
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

// ── The real cohort ─────────────────────────────────────────────────────────
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const rowsOf = (raw) => (Array.isArray(raw) ? raw : (raw.data ?? Object.values(raw)[0]));
const t = (v) => String(v ?? "").trim();

const seatRows = rowsOf(readJson(join(DATA, "induction21_seats.json"))).map((s) => ({
  program: t(s.typeName),
  quota: t(s.quotaName),
  specialty: t(s.specialityName),
  hospital: t(s.hospitalName),
  seats: s.seats,
}));

const specialtyName = new Map([
  [63, "Physical Medicine & Rehablitation"],
  [69, "Nuclear Medicine"],
  [70, "Immunology"],
  [71, "Virology"],
]);
for (const discipline of rowsOf(readJson(join(DATA, "disciplineFullData.json")))) {
  for (const s of discipline.specialities ?? []) {
    if (s.specialityId) specialtyName.set(s.specialityId, t(s.specialityName));
  }
}

const certsRaw = existsSync(join(PORTAL, "induction21_certificates.json"))
  ? readJson(join(PORTAL, "induction21_certificates.json"))
  : {};

const seatKeys = new Set(
  seatRows.map((s) => [s.program, s.specialty, s.hospital, s.quota].join("|"))
);

const candidatesRaw = readJson(join(INGEST, "induction21_candidates.json"));
const candidates = [];
const marksByCandidate = new Map();
const bonusByCandidateSeat = new Map();

for (const [id, c] of Object.entries(candidatesRaw)) {
  const applicantId = Number(id);
  marksByCandidate.set(applicantId, c.marksTotal ?? 0);

  const certList = Array.isArray(certsRaw[id]) ? certsRaw[id] : Object.values(certsRaw[id] ?? {});
  const bestCert = new Map();
  for (const cert of certList) {
    const k = `${cert.typeId}_${cert.disciplineId}`;
    const value = cert.certificateMarks ?? cert.computerizedMarks ?? 0;
    if (value > (bestCert.get(k) ?? -Infinity)) bestCert.set(k, value);
  }

  const preferences = [];
  for (const p of c.preferences ?? []) {
    const specialty = specialtyName.get(p.specialityId);
    if (!specialty) continue;
    const key = [t(p.typeName), specialty, t(p.hospitalName), t(p.quotaName)].join("|");
    if (!seatKeys.has(key)) continue;

    let bonus = 0;
    for (const disciplineId of p.disciplineIds ?? []) {
      const b = bestCert.get(`${p.typeId}_${disciplineId}`) ?? 0;
      if (b > bonus) bonus = b;
    }
    bonusByCandidateSeat.set(`${applicantId}::${key}`, bonus);

    preferences.push({
      preference_no: p.preferenceNo,
      program: t(p.typeName),
      quota: t(p.quotaName),
      specialty,
      hospital: t(p.hospitalName),
    });
  }

  if (preferences.length) {
    candidates.push({ applicantId, nameFull: c.nameFull ?? "", preferences });
  }
}

const effectiveMark = (applicantId, seatKey) =>
  (marksByCandidate.get(applicantId) ?? 0) +
  (bonusByCandidateSeat.get(`${applicantId}::${seatKey}`) ?? 0);

console.log(
  `\nloaded ${candidates.length} candidates with preferences, ${seatRows.length} seats`
);

console.log("\ninvariants over the real cohort");

const byProgram = new Map();
for (const program of [...new Set(seatRows.map((s) => s.program))]) {
  const result = runPlacement({
    program,
    seats: seatRows,
    candidates,
    effectiveMark,
  });
  byProgram.set(program, result);
  console.log(
    `      ${program}: ${result.stats.filled}/${result.stats.seats} seats · ` +
      `${result.stats.placed}/${result.stats.competitors} competitors placed · ` +
      `${result.stats.passes} passes`
  );
}

for (const [program, result] of byProgram) {
  checkThat(
    `${program} converges well inside the guard`,
    result.stats.passes > 0 && result.stats.passes < 100,
    `${result.stats.passes} passes`
  );

  const over = result.slots.filter((s) => s.placed.length > s.capacity);
  check(`${program} fills no seat beyond capacity`, over.length, 0);

  // A candidate may hold one seat per track and no more.
  const holdings = new Map();
  for (const slot of result.slots) {
    for (const c of slot.placed) {
      const k = `${c.applicantId}::${c.track}`;
      holdings.set(k, (holdings.get(k) ?? 0) + 1);
    }
  }
  check(
    `${program} places nobody twice within a track`,
    [...holdings.values()].filter((n) => n > 1).length,
    0
  );

  // Placed candidates must be ordered by mark, and the cutoff must be the last
  // of them — the cutoff is read off this list, so an unsorted list is a wrong
  // cutoff rather than a cosmetic problem.
  const misordered = result.slots.filter((s) =>
    s.placed.some((c, i) => i > 0 && s.placed[i - 1].mark < c.mark)
  );
  check(`${program} lists placed candidates strongest first`, misordered.length, 0);

  const badCutoff = result.slots.filter(
    (s) =>
      s.cutoff != null && s.cutoff !== s.placed[s.placed.length - 1]?.mark
  );
  check(`${program} reports the lowest placed mark as the cutoff`, badCutoff.length, 0);

  const cutoffOnUnfilled = result.slots.filter(
    (s) => s.cutoff != null && s.placed.length < s.capacity
  );
  check(`${program} reports no cutoff for an unfilled seat`, cutoffOnUnfilled.length, 0);

  // Next in line must be someone who would actually take the seat.
  const badNext = result.slots.filter(
    (s) => s.nextInLine && s.others.find((o) => o.applicantId === s.nextInLine.applicantId)?.placedElsewhereAtBetterPreference
  );
  check(`${program} does not offer a better-placed candidate as next in line`, badNext.length, 0);
}

// ── Graded against the published round 1 ────────────────────────────────────
console.log("\nagreement with the published round 1");

const round1 = rowsOf(readJson(join(PORTAL, "induction21_merit_round1.json")));
const actual = new Map();
for (const e of round1) {
  const k = [t(e.typeName), t(e.specialityName), t(e.hospitalName), t(e.quotaName)].join("|");
  if (!actual.has(e.applicantId)) actual.set(e.applicantId, k);
}

const simulated = new Map();
for (const result of byProgram.values()) {
  for (const slot of result.slots) {
    for (const c of slot.placed) {
      const k = [slot.program, slot.specialty, slot.hospital, slot.quota].join("|");
      if (!simulated.has(c.applicantId)) simulated.set(c.applicantId, k);
    }
  }
}

let common = 0;
let same = 0;
for (const [applicantId, key] of simulated) {
  const theirs = actual.get(applicantId);
  if (!theirs) continue;
  common++;
  if (theirs === key) same++;
}

const agreement = common ? (same / common) * 100 : 0;
console.log(
  `      ${same}/${common} same seat (${agreement.toFixed(1)}%) · ` +
    `${simulated.size} simulated, ${actual.size} published`
);

checkThat(
  "the run and the published round 1 share most candidates",
  common > actual.size * 0.7,
  `${common} common of ${actual.size} published`
);

// A floor, not a target. The run scores 89.3%, and exactness is not available:
// round 1 already reflects eligibility rulings and manual corrections that no
// published input describes. 85 sits just under the observed figure — close
// enough to catch a rule breaking, which moves this by tens of points, and far
// enough not to fail on ordinary drift in the source data.
checkThat(
  "agreement with the published round 1 is at least 85%",
  agreement >= 85,
  `${agreement.toFixed(1)}% — investigate before adjusting this floor`
);

console.log("\ndeterminism");
const again = runPlacement({
  program: "FCPS",
  seats: seatRows,
  candidates,
  effectiveMark,
});
check(
  "two runs over identical input agree exactly",
  JSON.stringify(again.stats),
  JSON.stringify(byProgram.get("FCPS").stats)
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
