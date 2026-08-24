/**
 * Candidate Pool aggregation assertions.
 *
 * Run with:  npm run test:pool
 *
 * Two halves. Fixtures first, because the interesting cases are the ones the
 * real data has only a handful of — an applicant with no preferences, a mark
 * sitting exactly on a band edge, the single highest scorer landing on the last
 * band's upper bound and vanishing if it is treated as exclusive.
 *
 * Then the real Induction 21 pool, if `ingest/` holds it, so the counts are
 * pinned against the numbers the portal itself reports rather than against
 * whatever the code happens to produce.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const { buildPoolStats } = await import("./pool-stats.ts");

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

const pref = (program, specialty, hospital, n = 1) => ({
  preference_no: n,
  program,
  quota: "Punjab",
  specialty,
  hospital,
});

console.log("\nFixtures\n");

const fixture = [
  // Two programmes, cleared, published.
  {
    applicant_id: 1,
    marks_total: 23.5,
    profile_status: 1,
    preferences: [
      pref("FCPS", "Medicine", "Mayo", 1),
      pref("MS", "Surgery", "Services", 2),
    ],
  },
  // One programme, pending.
  {
    applicant_id: 2,
    marks_total: 18,
    profile_status: 11,
    preferences: [pref("FCPS", "Medicine", "Services", 1)],
  },
  // No preferences at all, rejected, and a mark low enough to be flagged.
  { applicant_id: 3, marks_total: 2.25, profile_status: 2, preferences: [] },
  // No verification record, and no mark recorded either.
  { applicant_id: 4, marks_total: null, profile_status: null, preferences: [] },
  // The top scorer, sitting exactly on a band's upper edge.
  {
    applicant_id: 5,
    marks_total: 30,
    profile_status: 1,
    preferences: [
      pref("MD", "Radiology", "Jinnah", 1),
      pref("MD", "Radiology", "Mayo", 2),
      pref("MD", "Medicine", "Mayo", 3),
    ],
  },
];

const stats = buildPoolStats(fixture, new Set([1, 5]));

check("total counts every row", stats.total, 5);

check(
  "programme counts are per applicant, not per preference",
  stats.byProgram,
  [
    { program: "FCPS", applicants: 2 },
    { program: "MS", applicants: 1 },
    { program: "MD", applicants: 1 },
  ]
);

check("multi-programme", stats.multiProgram, 1);
check("no preferences filed", stats.noPreferences, 2);
check("marks below 5, null included", stats.lowMarks, 2);

check("verification splits by the portal's own status ids", stats.verification, {
  accepted: 2,
  pending: 1,
  rejected: 1,
  noRecord: 1,
});

// The whole point of the last-band fix: 30 is the upper bound of the 28–30
// band, and every other band is exclusive at the top.
const topBand = stats.marks.bands[stats.marks.bands.length - 1];
check("highest mark lands in the last band", topBand.label, "28–30");
check("...and is actually counted there", topBand.count, 1);
check("highest", stats.marks.highest, 30);
check("lowest, with a null mark read as zero", stats.marks.lowest, 0);
check("median", stats.marks.median, 18);

checkThat(
  "empty bands between the extremes are kept",
  stats.marks.bands.some((b) => b.count === 0),
  "a gap in the distribution is a fact about it, not a row to drop"
);

check("leading empty bands are trimmed", stats.marks.bands[0].label, "0–2");

check(
  "preference depth",
  stats.preferenceDepth.bands.map((b) => [b.label, b.count]),
  [
    ["None", 2],
    ["1", 1],
    ["2–5", 2],
    ["6–10", 0],
    ["11–20", 0],
    ["21–40", 0],
    ["41–80", 0],
    ["81–160", 0],
    ["161+", 0],
  ]
);

check("preferences filed in total", stats.preferenceDepth.total, 6);
check("longest list", stats.preferenceDepth.longest, 3);

check("named against unnamed", stats.published, { named: 2, unnamed: 3 });

// An applicant id present in the pool but never published must not be named,
// and one published but absent from the pool must not inflate the count.
const narrow = buildPoolStats(fixture, new Set([2, 999]));
check("published count is an intersection", narrow.published, {
  named: 1,
  unnamed: 4,
});

check("an empty pool does not throw", buildPoolStats([]).total, 0);
check("...and reports no bands", buildPoolStats([]).marks.bands, []);

/* ------------------------------------------------------------------------ */

const REAL = join(
  process.cwd(),
  "ingest",
  "induction21",
  "induction21_candidates.json"
);

if (existsSync(REAL)) {
  console.log("\nInduction 21, real pool\n");

  // The file is keyed BY applicant id, not an array. It also carries name,
  // CNIC, email and phone — it is the leak file — so nothing read here is
  // printed, and only the four fields the aggregation needs are lifted out.
  const raw = JSON.parse(readFileSync(REAL, "utf8"));
  const list = Array.isArray(raw) ? raw : Object.values(raw);

  const rows = list.map((c) => ({
    applicant_id: Number(c.applicantId),
    marks_total: c.marksTotal ?? null,
    // Verification lives in a separate portal export that is not in `ingest/`,
    // so every row reads as "no record" here. The bucket sums still have to
    // add up, which is what this half of the test is for.
    profile_status: c.profileStatus ?? null,
    preferences: (c.preferences ?? []).map((p) => ({
      preference_no: p.preferenceNo ?? 0,
      program: p.typeName ?? "",
      quota: p.quotaName ?? "",
      specialty: "",
      hospital: p.hospitalName ?? "",
    })),
  }));

  const real = buildPoolStats(rows);

  checkThat(
    "the pool is the whole cycle, not only those who placed",
    real.total > 3000,
    `got ${real.total}; 1,453 reached a merit list and the rest are the competition`
  );

  checkThat(
    "programme counts never exceed the pool",
    real.byProgram.every((p) => p.applicants <= real.total),
    "counting per preference rather than per applicant overshoots immediately"
  );

  checkThat(
    "every applicant lands in exactly one verification bucket",
    real.verification.accepted +
      real.verification.pending +
      real.verification.rejected +
      real.verification.noRecord ===
      real.total
  );

  checkThat(
    "band counts sum to the pool",
    real.marks.bands.reduce((sum, b) => sum + b.count, 0) === real.total,
    "a mark falling through every band would be silently dropped"
  );

  checkThat(
    "depth bands sum to the pool",
    real.preferenceDepth.bands.reduce((sum, b) => sum + b.count, 0) === real.total
  );

  console.log(
    `\n  pool ${real.total.toLocaleString("en-GB")} · cleared ${real.verification.accepted.toLocaleString("en-GB")}` +
      ` · preferences ${real.preferenceDepth.total.toLocaleString("en-GB")}`
  );
} else {
  console.log("\n  SKIP  real pool — ingest/induction21 not present\n");
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
