/**
 * Synthetic candidate fixtures.
 *
 * Development must never run against real candidate records. This generates
 * data with the same shape as the pipeline's `induction21_candidates.json`
 * (keyed by applicantId) but with values that cannot belong to a real person:
 *
 *   - emails use the reserved `.invalid` TLD, which by RFC 2606 can never
 *     resolve, so a stray mail send cannot reach anyone
 *   - CNICs use the 00000 area prefix, which NADRA does not issue
 *   - PMDC numbers are prefixed FAKE-
 *   - names are assembled from syllables, not drawn from any real list
 *
 * Specialty, hospital, program, and quota values ARE real — they come from
 * `public/data/flat_lookup.json`, which contains no personal fields and is
 * public by design. Using the real taxonomy is what makes the fixtures useful:
 * the simulation engines key off exact specialty and hospital strings.
 *
 * Output is deterministic (seeded PRNG), so it is committed and everyone gets
 * an identical database.
 *
 * Usage:  npm run fixtures -- [count]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const COUNT = Number(process.argv[2] ?? 250);

// mulberry32 — small, fast, and seeded, so runs are reproducible.
function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(20260809);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const intBetween = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const round2 = (n) => Math.round(n * 100) / 100;

// ---- real taxonomy, no personal fields --------------------------------------

const lookup = JSON.parse(
  readFileSync(join(repoRoot, "public", "data", "flat_lookup.json"), "utf8")
);
const rows = Array.isArray(lookup) ? lookup : Object.values(lookup)[0];

const combos = rows.map((r) => ({
  program: r.program,
  specialty: r.specialty,
  hospital: r.hospital,
  quota: r.quota,
}));

const specialties = [...new Set(combos.map((c) => c.specialty))].sort();
const specialtyId = new Map(specialties.map((s, i) => [s, i + 1]));
const programs = [...new Set(combos.map((c) => c.program))].sort();
const programId = new Map(programs.map((p, i) => [p, i + 1]));

// ---- obviously-synthetic personal fields ------------------------------------

const FIRST = ["Ay", "Bil", "Dan", "Eh", "Fa", "Gul", "Ha", "Im", "Ja", "Ka",
               "La", "Ma", "Na", "Om", "Qa", "Ra", "Sa", "Ta", "Um", "Za"];
const MID = ["ra", "an", "il", "ee", "ur", "am", "in", "oo", "ay", "us"];
const LAST = ["Ahmad", "Bashir", "Chaudhry", "Daud", "Farooq", "Gilani",
              "Hussain", "Iqbal", "Javed", "Khan", "Malik", "Nawaz",
              "Qureshi", "Rashid", "Siddiqui", "Tariq", "Yousaf", "Zafar"];

function syntheticName() {
  return `${pick(FIRST)}${pick(MID)} ${pick(LAST)}`;
}

/** 00000 is not an issued NADRA area code, so this cannot be a real CNIC. */
function syntheticCnic(n) {
  return `00000-${String(n).padStart(7, "0")}-${n % 10}`;
}

function syntheticPmdc(n) {
  return `FAKE-${String(n).padStart(6, "0")}`;
}

/** Reserved TLD — RFC 2606 guarantees `.invalid` never resolves. */
function syntheticEmail(n) {
  return `candidate${String(n).padStart(5, "0")}@example.invalid`;
}

function syntheticPhone(n) {
  return `0300-000-${String(n % 10000).padStart(4, "0")}`;
}

// ---- record assembly --------------------------------------------------------

function buildPreferences(count) {
  const chosen = [];
  const seen = new Set();
  while (chosen.length < count) {
    const c = pick(combos);
    const key = `${c.program}|${c.specialty}|${c.hospital}`;
    if (seen.has(key)) continue;
    seen.add(key);
    chosen.push(c);
  }
  return chosen.map((c, i) => ({
    specialityId: specialtyId.get(c.specialty) ?? 0,
    // The upstream candidate file carries only specialityId here, but the merit
    // tables are keyed on the specialty NAME, and the simulation engines match
    // on the exact string. Carrying it avoids an id->name lookup at seed time.
    specialityName: c.specialty,
    typeName: c.program,
    typeId: programId.get(c.program) ?? 0,
    hospitalName: c.hospital,
    instituteName: c.hospital,
    preferenceNo: i + 1,
    quotaName: c.quota,
    programMarks: round2(intBetween(4000, 8500) / 100),
    disciplineIds: [specialtyId.get(c.specialty) ?? 0],
    marks: round2(intBetween(4000, 8500) / 100),
    parentInstitute: rng() < 0.25,
  }));
}

const candidates = {};
for (let i = 1; i <= COUNT; i++) {
  // Offset well clear of the real 5-digit applicant IDs, so a fixture record is
  // recognisable at a glance and can never collide with a production one.
  const applicantId = 900000 + i;
  const marksTotal = round2(intBetween(3500, 8800) / 100);

  candidates[applicantId] = {
    applicantId,
    nameFull: syntheticName(),
    pmdcNo: syntheticPmdc(i),
    emailId: syntheticEmail(i),
    contactNumber: syntheticPhone(i),
    cnic: syntheticCnic(i),
    preferences: buildPreferences(intBetween(3, 12)),
    applied_in: {
      FCPS: rng() < 0.8,
      MS: rng() < 0.35,
      MD: rng() < 0.3,
      MDS: rng() < 0.08,
      FCPSD: rng() < 0.05,
    },
    marksTotal,
  };
}

mkdirSync(here, { recursive: true });
const outPath = join(here, "candidates.json");
writeFileSync(outPath, JSON.stringify(candidates, null, 1));

console.log(`wrote ${COUNT} synthetic candidates -> ${outPath}`);
console.log(`  applicantId range 900001..${900000 + COUNT}`);
console.log(`  ${specialties.length} real specialties, ${combos.length} real seat combos`);
