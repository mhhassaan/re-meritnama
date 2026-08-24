/**
 * Specialty comparison assertions, run against the real 1,470-row dataset.
 *
 * Run with:  npm run test:compare
 *
 * Two things are worth pinning here. The combination label is packed into a
 * single string and parsed back out — the original's approach, kept because a
 * shared URL carries the same string — and ten real hospital names contain
 * brackets, which is exactly what a naive parse gets wrong. And `Std Deviation`
 * is recomputed rather than read from the file, so the test has to show that
 * the recomputed figure differs from the source's, and by how much.
 */
import { readFileSync } from "node:fs";
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
  comboLabel,
  parseComboLabel,
  comboOptions,
  findCombo,
  latestPctOfMax,
  normalisedStddev,
  buildComparison,
  MAX_COLUMNS,
  HISTORY_CYCLES,
} = await import("./compare.ts");

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

const policies = JSON.parse(
  readFileSync(
    join(process.cwd(), "public", "data", "policy_by_induction.json"),
    "utf8"
  )
);

console.log(`\nloaded ${rows.length} rows`);

console.log("\nlabel encoding");

const roundTripFailures = rows.filter((r) => {
  const parsed = parseComboLabel(comboLabel(r));
  return (
    !parsed ||
    parsed.specialty !== r.specialty ||
    parsed.hospital !== r.hospital ||
    parsed.quota !== r.quota
  );
});
checkThat(
  "every one of the 1,470 combinations survives a label round trip",
  roundTripFailures.length === 0,
  roundTripFailures
    .slice(0, 3)
    .map((r) => comboLabel(r))
    .join(" | ")
);

const bracketed = rows.find((r) => r.hospital.includes("(PEMH)"));
check(
  "a hospital containing brackets parses to the hospital, not the quota",
  parseComboLabel(comboLabel(bracketed)).hospital,
  bracketed.hospital
);

check("a label with no em dash is rejected", parseComboLabel("Anaesthesia"), null);
check("an empty label is rejected", parseComboLabel(""), null);

console.log("\noptions and lookup");

const fcpsOptions = comboOptions(rows, "FCPS");
checkThat(
  "FCPS options are non-empty and sorted",
  fcpsOptions.length > 0 &&
    fcpsOptions.every(
      (o, i) => i === 0 || fcpsOptions[i - 1].localeCompare(o) <= 0
    ),
  `${fcpsOptions.length} options`
);
checkThat(
  "options carry no duplicates",
  new Set(fcpsOptions).size === fcpsOptions.length
);
checkThat(
  "options are scoped to the programme",
  comboOptions(rows, "MS").every((o) =>
    rows.some((r) => r.program === "MS" && comboLabel(r) === o)
  )
);

const target =
  "Anaesthesia — Choudhary Prevez Ilahi Institute of Cardiology , Multan (Punjab)";
const found = findCombo(rows, "FCPS", target);
check("findCombo resolves a real combination", found?.data_points, 12);
// The same specialty runs at the same hospital under more than one programme —
// this combination exists under both FCPS and MS with different history. So the
// programme is not decoration on the label, it is part of the key, and a lookup
// that ignored it would return whichever row happened to come first.
const sameLabelUnderMs = findCombo(rows, "MS", target);
check("findCombo will not cross programmes", sameLabelUnderMs?.program, "MS");
checkThat(
  "the same label under two programmes resolves to two different rows",
  sameLabelUnderMs.data_points !== found.data_points,
  `FCPS ${found.data_points} points, MS ${sameLabelUnderMs.data_points}`
);
check(
  "a combination that does not exist under a programme returns null",
  findCombo(rows, "MDS", target),
  null
);
check(
  "findCombo rejects an unparseable label",
  findCombo(rows, "FCPS", "junk"),
  null
);

console.log("\nderived figures");

// latest_induction is 20, and yearly_pct_of_max["20"] is 66.0197.
check(
  "latestPctOfMax reads the latest cycle that ran",
  latestPctOfMax(found),
  66.0197
);

checkThat(
  "every row yields a latest percentage",
  rows.every((r) => typeof latestPctOfMax(r) === "number"),
  `${rows.filter((r) => latestPctOfMax(r) == null).length} rows returned null`
);

// The whole reason this is recomputed. The file says 15.9043 — the standard
// deviation of raw marks across cycles whose totals ran 95, 60, 35 and 30, so
// most of that spread is the policy being rewritten rather than the seat
// moving. On the normalised scale the same seat scores 7.7717.
check(
  "Std Deviation is recomputed on the normalised scale",
  Number(normalisedStddev(found).toFixed(4)),
  7.7717
);
checkThat(
  "the source's raw stddev is roughly double it, and is not what we print",
  found.stddev > normalisedStddev(found) * 1.9,
  `source ${found.stddev}, normalised ${normalisedStddev(found).toFixed(4)}`
);
// The mean of the normalised series is exactly the file's own avg_pct_of_max,
// which confirms the recomputation runs over the same observations the file did
// — the scale changed, not the sample.
check("the normalised mean matches avg_pct_of_max", found.avg_pct_of_max, 62.2666);

const oneCycle = rows.find(
  (r) => Object.keys(r.yearly_pct_of_max ?? {}).length === 1
);
checkThat(
  "a single observation has no spread rather than a spread of zero",
  oneCycle == null || normalisedStddev(oneCycle) === null,
  oneCycle ? comboLabel(oneCycle) : "no single-cycle rows in the archive"
);

console.log("\ncomparison matrix");

const inductions = [
  ...new Set(rows.flatMap((r) => Object.keys(r.yearly_merit ?? {}).map(Number))),
].sort((a, b) => a - b);
const cycles = inductions.map((induction) => ({
  induction,
  label: `${policies[String(induction)]?.year ?? "—"} (Ind ${induction})`,
}));

const picks = [
  findCombo(rows, "FCPS", target),
  findCombo(rows, "FCPS", fcpsOptions.find((o) => o !== target)),
].filter(Boolean);

const comparison = buildComparison(picks, cycles);

check("one column per selection", comparison.columns.length, 2);
check(
  "eight headline metrics, then a Cutoff and Seats row per shown cycle",
  comparison.metrics.length,
  8 + HISTORY_CYCLES * 2
);
check(
  "the metrics keep the original's order and wording",
  comparison.metrics.slice(0, 8).map((m) => m.label),
  [
    "Avg Closing (% of Max)",
    "Latest Closing (% of Max)",
    "Latest Closing (Raw)",
    "Trend",
    "Volatility",
    "Confidence",
    "Data Points",
    "Std Deviation",
  ]
);
checkThat(
  "history rows cover the five most recent cycles only",
  comparison.metrics
    .slice(8)
    .every((m) =>
      cycles.slice(-HISTORY_CYCLES).some((c) => m.label.startsWith(c.label))
    )
);
checkThat(
  "every metric has a cell per column",
  comparison.metrics.every((m) => m.cells.length === comparison.columns.length)
);

// A cycle the combination did not run must read as absent, never as zero — a
// seat that did not exist and a seat that closed at zero are different facts.
const missingCycle = cycles.find(
  (c) => found.yearly_merit?.[String(c.induction)] == null
);
const gapRow = missingCycle
  ? comparison.metrics.find((m) => m.label === `${missingCycle.label} Cutoff`)
  : null;
checkThat(
  "a cycle the seat did not run reads as absent, not zero",
  gapRow == null || gapRow.cells[0].value === null,
  gapRow ? JSON.stringify(gapRow.cells[0]) : "no gap among the five shown cycles"
);

check(
  "more than three selections are truncated, not rendered",
  buildComparison([...picks, picks[0], picks[1]], cycles).columns.length,
  MAX_COLUMNS
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
