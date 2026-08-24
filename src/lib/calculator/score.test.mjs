import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scoreAll, scoreComponent, bandFor } from "./score.ts";

/**
 * The calculator's arithmetic, checked against the live site's own output.
 *
 * The reference case was produced by entering the values below into
 * itskaero.github.io/meritnama and reading the result box: 23.64 / 30, with the
 * breakdown 1.56 / 10.88 / 1.20 / 5.00 / 5.00. If this file ever disagrees with
 * those numbers, this implementation is wrong, not the test.
 */

const policyFile = JSON.parse(
  readFileSync(new URL("../../../public/data/policy_by_induction.json", import.meta.url), "utf8")
);

const raw = policyFile["21"];
const policy = {
  induction: raw.induction_id,
  year: raw.year,
  label: raw.label,
  totalMarks: raw.total_marks,
  notes: raw.notes ?? null,
  policyRef: raw.policy_ref ?? null,
  tidbits: raw.tidbits ?? [],
  components: raw.components,
};

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (error) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${error.message}`);
    failed++;
  }
}

function section(name) {
  console.log(`\n${name}`);
}

section("policy data");

test("Induction 21 carries a 30-mark formula", () => {
  assert.equal(policy.totalMarks, 30);
  assert.equal(policy.induction, 21);
});

test("five components are scored, the rest are marked removed", () => {
  const included = policy.components.filter((c) => c.included);
  assert.equal(included.length, 5);
  assert.deepEqual(
    included.map((c) => c.key),
    ["mdcat", "mbbs_bds_degree", "university_positions", "house_job", "fcps_jcat"]
  );
});

test("the included maxima sum to the published total", () => {
  const sum = policy.components
    .filter((c) => c.included)
    .reduce((t, c) => t + c.max_marks, 0);
  assert.equal(sum, policy.totalMarks);
});

section("reference case — matches the live site exactly");

const reference = {
  mdcat: "78",
  mbbs_bds_degree: "72.5",
  university_positions: "2",
  house_job: "5",
  fcps_jcat_type: "fcps",
  fcps_jcat_attempt: "1st attempt",
};

test("total is 23.64 out of 30", () => {
  const result = scoreAll(policy, reference);
  assert.equal(result.total, 23.64);
  assert.equal(result.totalMarks, 30);
});

test("every component matches the published breakdown", () => {
  const { breakdown } = scoreAll(policy, reference);
  const earned = Object.fromEntries(breakdown.map((b) => [b.key, b.earned]));
  assert.equal(earned.mdcat, 1.56);
  assert.equal(earned.mbbs_bds_degree, 10.88);
  assert.equal(earned.university_positions, 1.2);
  assert.equal(earned.house_job, 5);
  assert.equal(earned.fcps_jcat, 5);
});

section("clamping — a mistyped value must not inflate the total");

test("an aggregate over 100% cannot exceed the component maximum", () => {
  const component = policy.components.find((c) => c.key === "mbbs_bds_degree");
  const result = scoreComponent(component, { mbbs_bds_degree: "800" });
  assert.equal(result.earned, 15);
});

test("more positions than the cap cannot exceed 3 marks", () => {
  const component = policy.components.find((c) => c.key === "university_positions");
  assert.equal(scoreComponent(component, { university_positions: "50" }).earned, 3);
});

test("five positions earn exactly the 3-mark cap", () => {
  const component = policy.components.find((c) => c.key === "university_positions");
  assert.equal(scoreComponent(component, { university_positions: "5" }).earned, 3);
});

section("unanswered components score zero, not NaN");

test("an empty form totals zero", () => {
  const result = scoreAll(policy, {});
  assert.equal(result.total, 0);
  assert.ok(result.breakdown.every((b) => b.earned === 0));
  assert.ok(result.breakdown.every((b) => b.value === "—"));
});

test("a blank string is not read as zero-percent-entered", () => {
  const component = policy.components.find((c) => c.key === "mdcat");
  assert.equal(scoreComponent(component, { mdcat: "   " }).value, "—");
});

test("non-numeric text scores nothing rather than NaN", () => {
  const component = policy.components.find((c) => c.key === "mdcat");
  const result = scoreComponent(component, { mdcat: "abc" });
  assert.equal(result.earned, 0);
  assert.ok(!Number.isNaN(result.earned));
});

section("FCPS / JCAT combo");

const combo = policy.components.find((c) => c.key === "fcps_jcat");

test("FCPS attempts score 5, 4, 3, 0", () => {
  const marks = ["1st attempt", "2nd attempt", "3rd attempt", "4th attempt or more"].map(
    (label) =>
      scoreComponent(combo, {
        fcps_jcat_type: "fcps",
        fcps_jcat_attempt: label,
      }).earned
  );
  assert.deepEqual(marks, [5, 4, 3, 0]);
});

test("a 4th attempt is distinguishable from an unanswered form", () => {
  const answered = scoreComponent(combo, {
    fcps_jcat_type: "fcps",
    fcps_jcat_attempt: "4th attempt or more",
  });
  const unanswered = scoreComponent(combo, { fcps_jcat_type: "fcps" });
  assert.equal(answered.earned, 0);
  assert.equal(unanswered.earned, 0);
  // Both score zero; only the reported value tells them apart.
  assert.notEqual(answered.value, unanswered.value);
  assert.equal(unanswered.value, "—");
});

test("JCAT bands: >75 scores 5, 65-75 scores 4, 60-65 scores 3, below 60 scores 0", () => {
  const at = (pct) =>
    scoreComponent(combo, {
      fcps_jcat_type: "jcat",
      fcps_jcat_jcat_pct: String(pct),
    }).earned;
  assert.equal(at(80), 5);
  assert.equal(at(75.01), 5);
  assert.equal(at(70), 4);
  assert.equal(at(65), 4);
  assert.equal(at(62), 3);
  assert.equal(at(60), 3);
  assert.equal(at(59.9), 0);
  assert.equal(at(0), 0);
});

test("the boundary at exactly 75 falls in the 65-75 band, not above it", () => {
  // The threshold is 75.01, so 75 is deliberately NOT the top band.
  const earned = scoreComponent(combo, {
    fcps_jcat_type: "jcat",
    fcps_jcat_jcat_pct: "75",
  }).earned;
  assert.equal(earned, 4);
});

test("declaring neither qualification scores zero and says so", () => {
  const result = scoreComponent(combo, { fcps_jcat_type: "none" });
  assert.equal(result.earned, 0);
  assert.equal(result.value, "Neither / not applicable");
});

section("house job tiers");

test("Punjab scores 5, outside Punjab 2.5, not completed 0", () => {
  const component = policy.components.find((c) => c.key === "house_job");
  assert.equal(scoreComponent(component, { house_job: "5" }).earned, 5);
  assert.equal(scoreComponent(component, { house_job: "2.5" }).earned, 2.5);
  assert.equal(scoreComponent(component, { house_job: "0" }).earned, 0);
});

section("banding is relative to the record, not a fixed cutoff");

test("a perfect score lands in the top band", () => {
  const distribution = [10, 20, 30, 40, 50, 60, 70, 80, 90, 95];
  const { band } = bandFor(30, 30, distribution);
  assert.equal(band.id, "top");
});

test("a bottom score lands in the low band", () => {
  const distribution = [10, 20, 30, 40, 50, 60, 70, 80, 90, 95];
  const { band } = bandFor(1.5, 30, distribution);
  assert.equal(band.id, "low");
});

test("the same marks band differently when the total changes", () => {
  const distribution = [10, 20, 30, 40, 50, 60, 70, 80, 90, 95];
  // 25 marks is 83% of 30 but only 26% of 95.
  assert.equal(bandFor(25, 30, distribution).band.id, "top");
  assert.equal(bandFor(25, 95, distribution).band.id, "low");
});

test("an empty distribution does not throw or divide by zero", () => {
  const { band, percentile } = bandFor(20, 30, []);
  assert.ok(band);
  assert.equal(percentile, 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
