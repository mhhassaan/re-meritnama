#!/usr/bin/env node
/**
 * Loads the joining export — who actually reported to their allocated seat.
 *
 * Input:  ingest/induction21/induction21_joining_status.json
 * Output: public.joining_status
 *
 * ── The dates are DD/MM/YYYY, and `new Date()` gets them wrong ────────────
 *
 * The export writes `"04/06/2026"`, meaning 4 June 2026. JavaScript's `Date`
 * reads a bare `dd/mm/yyyy` string as **month first**, so it returns 6 April —
 * and where the day is above 12 there is no such month and it returns
 * `Invalid Date` outright.
 *
 * This is not hypothetical. **256 of the 1,082 rows have a day above 12**, and
 * none has a second component above 12, which settles the order beyond doubt.
 * The live portal parses them with `new Date()` and shows "Joined · Apr 6" for
 * a 4 June joining, and a literal "Invalid Date" for the other quarter of the
 * list.
 *
 * So the components are read textually and rebuilt, the same fix the schedule
 * needed for the same reason.
 *
 * ── What is deliberately NOT written ─────────────────────────────────────
 *
 * `cnic`, `emailId`, `contactNumber` — on every row of the source, read from
 * none of them.
 *
 * And the employment record the portal collects at joining: `empType`,
 * `empProvince`, `bps`, `dept`, `desg`. The original's own Joining Status card
 * does not show these, they are in no published gazette, and they were not in
 * the historic leak either — ingesting them would put this project ahead of
 * every other source. If something later needs them, they get their own table
 * and their own decision.
 *
 * ── Running it ───────────────────────────────────────────────────────────
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   SUPABASE_INGEST_ALLOW_PROJECT=<project-ref> \
 *   node supabase/ingest/joining-status.mjs [--dry-run]
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const INGEST_DIR = join(process.cwd(), "ingest", "induction21");
const INDUCTION = 21;
const BATCH = 500;

const DRY_RUN = process.argv.includes("--dry-run");

const t = (v) => (typeof v === "string" ? v.trim() : "");
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Same rules as the roster ingest — see `pool-directory.mjs`. */
const PARENTAGE = /\s+(?:D\/O|S\/O|W\/O|C\/O|Bint|Binte)\s+.*$/i;
const CNIC = /\d{5}-\d{7}-\d/;

const displayName = (v) => {
  const name = t(v).replace(PARENTAGE, "").trim();
  if (!name || CNIC.test(name) || !/\p{L}/u.test(name)) return null;
  return name;
};

/**
 * `DD/MM/YYYY` to an ISO date, read as digits rather than parsed.
 *
 * Returns null rather than guessing when the shape is not what this expects: a
 * wrong date on a joining record is worse than a missing one, because a reader
 * uses it to decide whether a seat is still contested.
 */
function joinedOn(raw) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t(raw));
  if (!match) return null;

  const [, day, month, year] = match;
  const d = Number(day);
  const m = Number(month);
  if (d < 1 || d > 31 || m < 1 || m > 12) return null;

  return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
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

  const path = join(INGEST_DIR, "induction21_joining_status.json");
  if (!existsSync(path)) {
    console.error(
      `Missing ${path}.\n` +
        `Ingest inputs are gitignored on purpose — this one carries CNIC, email\n` +
        `and phone for every joined candidate. Restore it locally before running.`
    );
    process.exit(1);
  }

  const raw = JSON.parse(await readFile(path, "utf8"));
  const source = Array.isArray(raw) ? raw : (raw.Table ?? Object.values(raw));

  let badDate = 0;
  let dayAboveTwelve = 0;

  const rows = source.map((r) => {
    const date = joinedOn(r.joiningDate);
    if (r.joiningDate && !date) badDate += 1;
    if (/^(\d{1,2})\//.exec(t(r.joiningDate))?.[1] > 12) dayAboveTwelve += 1;

    return {
      applicant_id: Number(r.applicantId),
      // One field at a time. A spread would carry cnic, emailId, contactNumber
      // and the whole employment record into a table verified users can read.
      name_full: displayName(r.name),
      pmdc_no: t(r.pmdcNo) || null,
      program: t(r.typeName),
      specialty: t(r.specialityName),
      hospital: t(r.hospitalName),
      institute: t(r.instituteName) || null,
      quota: t(r.quotaName),
      marks: num(r.marks),
      preference_no: num(r.preferenceNo),
      seats: num(r.seats),
      status: t(r.status) || "Pending",
      joined_on: date,
    };
  });

  const joined = rows.filter((r) => r.status === "Joined").length;
  const pending = rows.filter((r) => r.status !== "Joined").length;
  const withheld = source.filter((r) => t(r.name) && displayName(r.name) === null).length;
  const slots = new Set(
    rows.map((r) => `${r.program}|${r.specialty}|${r.hospital}|${r.quota}`)
  ).size;

  console.log(
    `joining_status: ${rows.length} rows\n` +
      `  joined         ${joined}\n` +
      `  pending        ${pending}\n` +
      `  seats tracked  ${slots}\n` +
      `  dates parsed   ${rows.filter((r) => r.joined_on).length}\n` +
      `  day > 12       ${dayAboveTwelve}   (these are the rows new Date() calls Invalid)\n` +
      `  name withheld  ${withheld}   (CNIC or no letters in the name field)`
  );

  if (badDate) {
    console.warn(`  WARNING: ${badDate} joining dates could not be parsed as DD/MM/YYYY`);
  }

  if (rows.length < 500) {
    console.error(`Refusing to write: only ${rows.length} rows — expected the whole export.`);
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log("\nDry run — nothing written.");
    return;
  }

  const db = createClient(url, key, { auth: { persistSession: false } });

  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { data, error } = await db.rpc("apply_joining_status", {
      p_induction: INDUCTION,
      p_rows: rows.slice(i, i + BATCH),
    });
    if (error) {
      console.error(`apply_joining_status failed at row ${i}: ${error.message}`);
      process.exit(1);
    }
    written += data ?? 0;
  }

  console.log(`\nDone. ${written} rows in joining_status.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
