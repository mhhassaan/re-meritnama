import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  bucketFor,
  countByBucket,
  percentileFor,
  predict,
  projectFor,
  requirementsFor,
} from "./predict.ts";

/**
 * The prediction maths, checked against the live site's own output.
 *
 * Reference case: merit 24.5 on the 30-mark 2026 formula, no programme or quota
 * filter. The live site reports 99th percentile, 1409 safe, 61 target, 0 reach.
 * If this file disagrees with those numbers, this implementation is wrong.
 */

const rows = JSON.parse(
  readFileSync(new URL("../../../public/data/flat_lookup.json", import.meta.url), "utf8")
);

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

const TOTAL_MARKS = 30;
const REFERENCE_MARKS = 24.5;

section("reference case — matches the live site exactly");

const results = predict(rows, REFERENCE_MARKS, TOTAL_MARKS);
const counts = countByBucket(results);

test("bucket counts are 1409 safe, 61 target, 0 reach", () => {
  assert.equal(counts.safe, 1409);
  assert.equal(counts.target, 61);
  assert.equal(counts.reach, 0);
});

test("the score normalises to 81.7% of max", () => {
  const userPct = (REFERENCE_MARKS / TOTAL_MARKS) * 100;
  assert.equal(Number(userPct.toFixed(1)), 81.7);
});

test("percentile is 99", () => {
  const distribution = rows
    .map((r) => r.avg_pct_of_max)
    .filter((v) => typeof v === "number");
  const userPct = (REFERENCE_MARKS / TOTAL_MARKS) * 100;
  assert.equal(percentileFor(userPct, distribution), 99);
});

section("bucket thresholds");

test("+3.0 is safe, +2.9 is target", () => {
  assert.equal(bucketFor(3.0), "safe");
  assert.equal(bucketFor(2.9), "target");
});

test("-5.0 is target, -5.1 is reach", () => {
  assert.equal(bucketFor(-5.0), "target");
  assert.equal(bucketFor(-5.1), "reach");
});

test("-15.0 is reach, -15.1 is dropped entirely", () => {
  assert.equal(bucketFor(-15.0), "reach");
  assert.equal(bucketFor(-15.1), null);
});

test("hopeless combinations are excluded, not shown as a fourth bucket", () => {
  // A score of 1 mark out of 30 is 3.3% — below every seat on record.
  const none = predict(rows, 1, TOTAL_MARKS);
  assert.equal(none.length, 0);
});

section("results are sorted by margin, best first");

test("delta descends across the whole result set", () => {
  for (let i = 1; i < results.length; i++) {
    assert.ok(
      results[i - 1].delta >= results[i].delta,
      `out of order at ${i}: ${results[i - 1].delta} then ${results[i].delta}`
    );
  }
});

test("every safe result outranks every reach result", () => {
  const lowest = predict(rows, 15, TOTAL_MARKS);
  const firstReach = lowest.findIndex((p) => p.bucket === "reach");
  const lastSafe = lowest.map((p) => p.bucket).lastIndexOf("safe");
  if (firstReach !== -1 && lastSafe !== -1) {
    assert.ok(lastSafe < firstReach);
  }
});

section("filtering");

test("a programme filter only returns that programme", () => {
  const fcps = predict(rows, REFERENCE_MARKS, TOTAL_MARKS, { program: "FCPS" });
  assert.ok(fcps.length > 0);
  assert.ok(fcps.every((p) => p.row.program === "FCPS"));
});

test("a quota filter only returns that quota", () => {
  const punjab = predict(rows, REFERENCE_MARKS, TOTAL_MARKS, { quota: "Punjab" });
  assert.ok(punjab.length > 0);
  assert.ok(punjab.every((p) => p.row.quota === "Punjab"));
});

test("filtering never produces more results than filtering by nothing", () => {
  const fcps = predict(rows, REFERENCE_MARKS, TOTAL_MARKS, { program: "FCPS" });
  assert.ok(fcps.length <= results.length);
});

section("projection — 'last year, nudged', and clamped");

test("a rising, high-volatility seat projects +2 with a ±6 spread", () => {
  const p = projectFor(60, "rising", "high");
  assert.equal(p.low, 56);
  assert.equal(p.high, 68);
});

test("a falling, low-volatility seat projects -2 with a ±1.5 spread", () => {
  const p = projectFor(60, "falling", "low");
  assert.equal(p.low, 56.5);
  assert.equal(p.high, 59.5);
});

test("a stable seat does not shift", () => {
  const p = projectFor(60, "stable", "medium");
  assert.equal(p.low, 57);
  assert.equal(p.high, 63);
});

test("projections never fall below 0 or rise above 100", () => {
  assert.equal(projectFor(2, "falling", "high").low, 0);
  assert.equal(projectFor(99, "rising", "high").high, 100);
});

test("a seat with no latest close has no projection rather than a fake one", () => {
  assert.equal(projectFor(null, "rising", "high"), null);
});

section("target mode — what a seat has demanded");

test("the needed marks are the projected ceiling on the current scale", () => {
  const sample = rows.filter((r) => r.specialty === "Anaesthesia").slice(0, 20);
  const reqs = requirementsFor(sample, TOTAL_MARKS);
  assert.ok(reqs.length > 0);
  for (const r of reqs) {
    assert.equal(r.neededMarks, Math.round((r.projectedHigh / 100) * TOTAL_MARKS * 100) / 100);
  }
});

test("the projection is capped at the highest figure ever actually recorded", () => {
  const sample = rows
    .filter((r) => Object.keys(r.yearly_pct_of_max ?? {}).length > 2)
    .slice(0, 400);

  for (const r of requirementsFor(sample, TOTAL_MARKS)) {
    const observed = Object.values(r.row.yearly_pct_of_max).filter(
      (v) => typeof v === "number" && v > 0
    );
    // Compared at one decimal place, which is the precision the figure is
    // displayed at. A seat that closed at 66.4926% renders as 66.5%, and
    // flooring the cap instead would understate a real recorded result.
    const ceiling = Math.round(Math.max(...observed) * 10) / 10;
    assert.ok(
      r.projectedHigh <= ceiling,
      `${r.row.specialty} projected ${r.projectedHigh} above observed max ${ceiling}`
    );
  }
});

test("needed marks never exceed the cycle total", () => {
  for (const r of requirementsFor(rows.slice(0, 300), TOTAL_MARKS)) {
    assert.ok(r.neededMarks <= TOTAL_MARKS);
    assert.ok(r.projectedLow >= 0);
  }
});

section("guards");

test("a zero marks total returns nothing rather than dividing by zero", () => {
  assert.deepEqual(predict(rows, 20, 0), []);
});

test("an empty distribution gives a percentile of 0, not NaN", () => {
  assert.equal(percentileFor(80, []), 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
