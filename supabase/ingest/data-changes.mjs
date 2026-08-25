#!/usr/bin/env node
/**
 * Loads the snapshot diff behind Candidate Data Changes.
 *
 * Input:  ingest/induction21/portal/candidates_changes.json
 * Output: public.data_changes, public.data_change_runs
 *
 * ── What this file is ────────────────────────────────────────────────────
 *
 * The portal publishes a precomputed diff of the applicant file against its
 * previous snapshot: 622 candidates, 4,035 records before and 4,045 after. The
 * original's page fetches it whole and renders it in the browser.
 *
 * It carries CNIC for 397 of those 622 records, and `nameFull` with parentage
 * for 400. So every field is read by name — a spread would put a national
 * identity number into a table verified users can query.
 *
 * ── What is dropped, and why each ────────────────────────────────────────
 *
 * `cnic`  — never read. Note that the original does not render CNIC changes
 *           either: the string "CNIC" appears nowhere on its page. Dropping
 *           the values matches its behaviour rather than diverging from it.
 *
 * `nameFull` old/new — the fact is kept as `field = 'name'`, the strings are
 *           not. Names here carry a father's name on essentially every row,
 *           and three applicants typed their CNIC into the name box, so a
 *           "previous name" column is free text already demonstrated to
 *           contain identity numbers. Display names come from
 *           `pool_directory`, which is parentage-stripped at ingest.
 *
 * `preferences`, seat by seat — 19,587 additions, 1,420 removals and 788
 *           edits, up to 357 on one candidate. Shipping those to the browser
 *           is both a large payload and, in aggregate, a copy of the whole
 *           cycle's preference data. **The counts are kept**, per programme,
 *           because 113 of the 622 changed records changed *nothing else* and
 *           would otherwise vanish from the page entirely. The list itself is
 *           already readable per candidate on the Candidate Pool, which is
 *           where a reader who wants the seats should go.
 *
 * ── The classification, which the original does not make ─────────────────
 *
 * Of the 440 total-marks changes, 358 go from 0 to a real mark and 25 go the
 * other way. Those are records being populated and blanked as the portal
 * finished data entry — not merit moving. Only 57 are a revision between two
 * real values, and most of those are a bare MDCAT score becoming a full
 * record (1.63 to 17.38 and so on).
 *
 * The original labels all 440 the same way, in the second person: "Your total
 * went up by 17.1343 points." Every row carries a `kind` so the page can say
 * which of the three it is.
 *
 * ── Running it ───────────────────────────────────────────────────────────
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   SUPABASE_INGEST_ALLOW_PROJECT=<project-ref> \
 *   node supabase/ingest/data-changes.mjs [--dry-run]
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const INGEST_DIR = join(process.cwd(), "ingest", "induction21", "portal");
const INDUCTION = 21;
const BATCH = 500;

const DRY_RUN = process.argv.includes("--dry-run");

/** Every field allowed through, with nothing else reachable by accident. */
const SCALAR_FIELDS = [
  "marksTotal",
  "degree",
  "houseJob",
  "mdcat",
  "position",
  "experience",
];

/** Fields whose value is an object keyed by programme code. */
const PER_PROGRAM_FIELDS = { programMarks: "programMarks", applied_in: "appliedIn" };

/** The source's own vocabulary for a preference delta, and our field name. */
const PREFERENCE_KINDS = {
  added: "prefAdded",
  removed: "prefRemoved",
  modified: "prefEdited",
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * How to read a movement between two numbers.
 *
 * Zero is the applicant file's "no record", not a score of nought, so a move
 * off or onto it is a record appearing or vanishing rather than a mark being
 * corrected. Getting this wrong is what makes the original's page read as
 * hundreds of people gaining 15 points.
 */
function classify(oldValue, newValue) {
  if (!oldValue && newValue) return "appeared";
  if (oldValue && !newValue) return "vanished";
  return "revised";
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const allowed = process.env.SUPABASE_INGEST_ALLOW_PROJECT;

  if (!DRY_RUN && (!url || !key)) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(1);
  }

  const ref = url ? new URL(url).hostname.split(".")[0] : null;
  if (!DRY_RUN && allowed !== ref) {
    console.error(
      `Refusing to write.\n` +
        `  target project : ${ref}\n` +
        `  allowed        : ${allowed ?? "(unset)"}\n\n` +
        `Set SUPABASE_INGEST_ALLOW_PROJECT=${ref} to confirm that is the project you mean.`
    );
    process.exit(1);
  }

  const path = join(INGEST_DIR, "candidates_changes.json");
  if (!existsSync(path)) {
    console.error(
      `Missing ${path}.\n` +
        `Ingest inputs are gitignored on purpose — this one carries CNIC for 397\n` +
        `of the 622 changed records. Restore it locally before running.`
    );
    process.exit(1);
  }

  const source = JSON.parse(await readFile(path, "utf8"));
  const summary = source.summary ?? {};

  const rows = [];
  let cnicSeen = 0;
  let namesSeen = 0;
  let preferenceDeltas = 0;

  for (const candidate of source.candidates ?? []) {
    const applicantId = Number(candidate.applicantId);
    if (!Number.isFinite(applicantId)) continue;

    preferenceDeltas += candidate.preferences?.length ?? 0;

    // Counted per programme, never listed. See the header for why both halves
    // of that sentence matter.
    const prefCounts = new Map();
    for (const delta of candidate.preferences ?? []) {
      const field = PREFERENCE_KINDS[delta.kind];
      if (!field) {
        // `kind: "count"` carries a whole-programme total rather than one
        // seat. One record in the source has it.
        if (delta.kind === "count") {
          rows.push({
            applicant_id: applicantId,
            field: "prefCount",
            program: delta.program ?? "",
            old_value: num(delta.oldCount),
            new_value: num(delta.newCount),
            kind: "revised",
          });
        }
        continue;
      }
      const key = `${field}|${delta.program ?? ""}`;
      prefCounts.set(key, (prefCounts.get(key) ?? 0) + 1);
    }

    for (const [key, count] of prefCounts) {
      const [field, program] = key.split("|");
      rows.push({
        applicant_id: applicantId,
        field,
        program,
        old_value: null,
        new_value: count,
        kind: "revised",
      });
    }

    for (const change of candidate.fields ?? []) {
      const field = change.field;

      // Counted so the run says out loud what it refused, rather than the
      // absence being invisible in a log that looks clean.
      if (field === "cnic") {
        cnicSeen += 1;
        continue;
      }

      if (field === "nameFull") {
        namesSeen += 1;
        rows.push({
          applicant_id: applicantId,
          field: "name",
          program: "",
          old_value: null,
          new_value: null,
          // A blank previous name is the record being filled in, a blank new
          // one is it being cleared, and two real names is a correction.
          // Which of the three it is, without either string.
          kind: classify(change.old ? 1 : 0, change.new ? 1 : 0),
        });
        continue;
      }

      if (field === "_record") {
        rows.push({
          applicant_id: applicantId,
          field: "record",
          program: "",
          old_value: null,
          new_value: null,
          kind: "added",
        });
        continue;
      }

      if (SCALAR_FIELDS.includes(field)) {
        const oldValue = num(change.old);
        const newValue = num(change.new);
        if (oldValue === newValue) continue;
        rows.push({
          applicant_id: applicantId,
          field,
          program: "",
          old_value: oldValue,
          new_value: newValue,
          kind: classify(oldValue, newValue),
        });
        continue;
      }

      const perProgram = PER_PROGRAM_FIELDS[field];
      if (perProgram) {
        const before = change.old ?? {};
        const after = change.new ?? {};
        for (const code of new Set([...Object.keys(before), ...Object.keys(after)])) {
          // Booleans for applied_in, marks for programMarks — both land as
          // numbers, so one column serves and the page decides how to print.
          const oldValue = num(before[code]);
          const newValue = num(after[code]);
          if (oldValue === newValue) continue;
          rows.push({
            applicant_id: applicantId,
            field: perProgram,
            program: code,
            old_value: oldValue,
            new_value: newValue,
            kind: classify(oldValue, newValue),
          });
        }
        continue;
      }

      // An unrecognised field is not written. A future export that adds one
      // should be read before it is published, not passed through.
      console.warn(`  skipped unrecognised field "${field}" on applicant ${applicantId}`);
    }
  }

  const byField = {};
  for (const row of rows) byField[row.field] = (byField[row.field] ?? 0) + 1;

  const marks = rows.filter((r) => r.field === "marksTotal");
  const kinds = { appeared: 0, vanished: 0, revised: 0 };
  for (const row of marks) kinds[row.kind] += 1;

  console.log(
    `data_changes: ${rows.length} rows over ${source.candidates?.length ?? 0} candidates\n` +
      `  pools          ${summary.oldCount} -> ${summary.newCount}` +
      `  (+${summary.added} added, -${summary.removed} removed, ${summary.changed} changed)\n` +
      `  by field       ${Object.entries(byField)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}=${v}`)
        .join(" ")}\n` +
      `  total marks    ${kinds.appeared} appeared, ${kinds.vanished} vanished, ${kinds.revised} revised\n` +
      `  WITHHELD       ${cnicSeen} cnic changes, ${namesSeen} name strings, ` +
      `${preferenceDeltas} preference deltas listed seat by seat (counts kept)`
  );

  if (rows.length < 1000) {
    console.error(`Refusing to write: only ${rows.length} rows — expected the whole diff.`);
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log("\nDry run — nothing written.");
    return;
  }

  const db = createClient(url, key, { auth: { persistSession: false } });

  const { error: runError } = await db.rpc("apply_data_change_run", {
    p_induction: INDUCTION,
    p_run: {
      generated_at: source.generatedAt ?? "",
      old_source: source.oldSource ?? null,
      new_source: source.newSource ?? null,
      old_count: summary.oldCount ?? 0,
      new_count: summary.newCount ?? 0,
      added: summary.added ?? 0,
      removed: summary.removed ?? 0,
      changed: summary.changed ?? 0,
      total_updates: summary.totalUpdates ?? 0,
    },
  });
  if (runError) {
    console.error(`apply_data_change_run failed: ${runError.message}`);
    process.exit(1);
  }

  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { data, error } = await db.rpc("apply_data_changes", {
      p_induction: INDUCTION,
      p_rows: rows.slice(i, i + BATCH),
    });
    if (error) {
      console.error(`apply_data_changes failed at row ${i}: ${error.message}`);
      process.exit(1);
    }
    written += data ?? 0;
  }

  console.log(`\nDone. ${written} rows in data_changes.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
