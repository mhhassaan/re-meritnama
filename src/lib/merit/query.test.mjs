/**
 * Merit query assertions, run against the real 1,470-row dataset.
 *
 * Run with:  npm run test:merit
 *
 * Real data rather than fixtures on purpose: the failure modes here come from
 * the shape of the actual archive — cycles a combination did not run, quota
 * values with trailing whitespace, and raw merits from incompatible scales.
 * A synthetic fixture would be tidy in exactly the ways the real file is not.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Imports the TypeScript module directly — Node strips types natively, so the
// logic under test is the same file the app imports, not a copy.

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

const { applyQuery, valueFor, latestValue, formatValue } = await import(
  "./query.ts"
);

const raw = JSON.parse(
  readFileSync(join(process.cwd(), "public", "data", "flat_lookup.json"), "utf8")
);
const rows = (Array.isArray(raw) ? raw : Object.values(raw)[0]).map((r) => ({
  ...r,
  program: r.program?.trim(),
  quota: r.quota?.trim(),
  specialty: r.specialty?.trim(),
  hospital: r.hospital?.trim(),
}));

console.log(`\nloaded ${rows.length} rows`);

console.log("\nfiltering");
const fcps = applyQuery(rows, { program: "FCPS" });
checkThat(
  "program filter returns only that program",
  fcps.every((r) => r.program === "FCPS") && fcps.length > 0,
  `${fcps.length} rows`
);

const punjab = applyQuery(rows, { quota: "Punjab" });
checkThat(
  "quota filter returns only that quota",
  punjab.every((r) => r.quota === "Punjab") && punjab.length > 0,
  `${punjab.length} rows`
);

// Trailing whitespace in the source would otherwise make this quota unmatchable.
const armed = applyQuery(rows, { quota: "Armed Force" });
checkThat(
  "quota with trailing space in source is matchable once trimmed",
  armed.length > 0,
  `${armed.length} rows`
);

const combined = applyQuery(rows, { program: "FCPS", quota: "Punjab" });
checkThat(
  "filters combine (AND, not OR)",
  combined.every((r) => r.program === "FCPS" && r.quota === "Punjab") &&
    combined.length <= Math.min(fcps.length, punjab.length),
  `${combined.length} rows`
);

console.log("\nsearch");
const search = applyQuery(rows, { search: "mayo" });
checkThat(
  "search matches hospital case-insensitively",
  search.length > 0 && search.every((r) => /mayo/i.test(`${r.specialty} ${r.hospital}`)),
  `${search.length} rows`
);
check("search with no match returns empty", applyQuery(rows, { search: "zzzznope" }).length, 0);

console.log("\nmissing cycles are absent, not zero");
{
  // A combination that did not run in a given cycle must read as "no data".
  const withGap = rows.find(
    (r) => r.yearly_merit && Object.keys(r.yearly_merit).length < 13
  );
  const ranIn = new Set(Object.keys(withGap.yearly_merit));
  const missing = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].find(
    (i) => !ranIn.has(String(i))
  );
  check("a cycle with no data returns null", valueFor(withGap, missing, "raw"), null);
  check("null formats as an em dash, never 0", formatValue(null, "raw"), "—");
}

console.log("\nsorting");
{
  const byLatestDesc = applyQuery(rows, {
    sort: "latest",
    direction: "desc",
    scale: "normalised",
  });
  const values = byLatestDesc
    .map((r) => latestValue(r, "normalised"))
    .filter((v) => v != null);
  const isDescending = values.every((v, i) => i === 0 || values[i - 1] >= v);
  checkThat("descending sort is actually descending", isDescending);

  // Rows without data must not float to the top of a descending sort.
  const firstNullIndex = byLatestDesc.findIndex(
    (r) => latestValue(r, "normalised") == null
  );
  checkThat(
    "rows with no data sort last, not first",
    firstNullIndex === -1 || firstNullIndex >= values.length,
    `first null at index ${firstNullIndex}, ${values.length} values`
  );
}

console.log("\nscales are not interchangeable");
{
  // The whole reason the normalise toggle exists: a raw merit from a 95-mark
  // cycle and one from a 30-mark cycle are different scales entirely.
  const row = rows.find(
    (r) => r.yearly_merit?.["8"] != null && r.yearly_merit?.["20"] != null
  );
  const raw8 = valueFor(row, 8, "raw");
  const raw20 = valueFor(row, 20, "raw");
  const pct8 = valueFor(row, 8, "normalised");
  const pct20 = valueFor(row, 20, "normalised");

  checkThat(
    "raw values across eras differ wildly",
    raw8 - raw20 > 20,
    `induction 8 raw=${raw8}, induction 20 raw=${raw20}`
  );
  checkThat(
    "normalised values are on one comparable 0-100 scale",
    pct8 <= 100 && pct20 <= 100 && pct8 > 0 && pct20 > 0,
    `induction 8 pct=${pct8}, induction 20 pct=${pct20}`
  );
  check("normalised formats with a percent sign", formatValue(pct20, "normalised").endsWith("%"), true);
  check("raw formats without one", formatValue(raw20, "raw").includes("%"), false);
}

console.log("\nresult integrity");
checkThat(
  "filtering never invents rows",
  applyQuery(rows, {}).length === rows.length,
  `${applyQuery(rows, {}).length} vs ${rows.length}`
);
checkThat(
  "sorting never drops rows",
  applyQuery(rows, { sort: "average", direction: "desc" }).length === rows.length
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
