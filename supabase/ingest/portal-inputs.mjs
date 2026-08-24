#!/usr/bin/env node
/**
 * Loads the Induction Portal's allocation inputs.
 *
 * Input:  ingest/induction21/induction21_candidates.json        (preferences)
 *         ingest/induction21/portal/induction21_certificates.json
 *         ingest/induction21/portal/ProfileStatus.json
 *         public/data/induction21_seats.json                    (capacities)
 *         public/data/disciplineFullData.json                   (specialty ids)
 *
 * Output: public.seats       — capacity per seat, no personal data
 *         public.candidates  — preferences, certificates, profile_status
 *         public.applicants  — the full allocation pool, no name, no contacts
 *
 * ── Why the seats file may stay in public/ and the rest may not ───────────
 *
 * `induction21_seats.json` and `disciplineFullData.json` are counts and names.
 * They carry nothing about any person, which is the same test the merit
 * aggregates pass. `induction21_candidates.json` carries CNIC, email and phone
 * for 3,474 doctors and lives in `ingest/`, which is gitignored and not served.
 *
 * ── What is deliberately NOT written ─────────────────────────────────────
 *
 * The candidates file has CNIC, email and contact number on every record. This
 * script reads none of those columns, for anyone.
 *
 * `public.applicants` receives all 3,474 applicants because the 2,021 who never
 * placed are the competition, and an allocation without them is optimistic
 * rather than merely incomplete. Those rows carry preferences, marks and
 * verification status — and no name. `merit_entries` already publishes the name
 * of everyone who placed; nobody has ever published the names of those who did
 * not, and this project is not going to be first.
 *
 * ── Running it ───────────────────────────────────────────────────────────
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   SUPABASE_INGEST_ALLOW_PROJECT=<project-ref> \
 *   node supabase/ingest/portal-inputs.mjs [--dry-run]
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const INGEST_DIR = join(process.cwd(), "ingest", "induction21");
const PORTAL_DIR = join(INGEST_DIR, "portal");
const DATA_DIR = join(process.cwd(), "public", "data");
const INDUCTION = 21;
const BATCH = 500;

const DRY_RUN = process.argv.includes("--dry-run");

/**
 * Specialty ids absent from the discipline file but present in preferences.
 *
 * Kept in step with `src/lib/portal/cascade.ts`, spellings included — these are
 * how the PHF portal writes them, and correcting either copy would stop
 * preferences joining to the seat rows they have to match.
 */
const MISSING_SPECIALTY_IDS = {
  63: "Physical Medicine & Rehablitation",
  69: "Nuclear Medicine",
  70: "Immunology",
  71: "Virology",
};

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const rowsOf = (raw) => (Array.isArray(raw) ? raw : (raw.data ?? Object.values(raw)[0]));

/**
 * Trailing whitespace is load-bearing here, in the worst way.
 *
 * The seats file carries trailing spaces on hospital names and specialties
 * ("Nishtar-II Hospital Multan ", "Radiation Oncology ") and on the
 * "Armed Force " quota. Preferences and consent titles arrive trimmed. Storing
 * either side untrimmed means a preference never matches its seat, which the
 * cascade cannot detect — it just quietly allocates fewer people.
 */
const t = (value) => String(value ?? "").trim();

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const allowed = process.env.SUPABASE_INGEST_ALLOW_PROJECT;

  if (!url || !key) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(1);
  }

  const ref = new URL(url).hostname.split(".")[0];
  if (!DRY_RUN && allowed !== ref) {
    console.error(
      `Refusing to write.\n` +
        `  target project : ${ref}\n` +
        `  allowed        : ${allowed ?? "(unset)"}\n\n` +
        `This loads real candidates' preference lists. Set\n` +
        `SUPABASE_INGEST_ALLOW_PROJECT=${ref} to confirm that is the project you mean.`
    );
    process.exit(1);
  }

  // ── Read ────────────────────────────────────────────────────────────────
  const candidatesPath = join(INGEST_DIR, "induction21_candidates.json");
  if (!existsSync(candidatesPath)) {
    console.error(
      `Missing ${candidatesPath}.\n` +
        `Ingest inputs are gitignored on purpose — they carry per-candidate\n` +
        `contact details. Restore them locally before running this.`
    );
    process.exit(1);
  }

  const candidatesRaw = await readJson(candidatesPath);
  const seatRows = rowsOf(await readJson(join(DATA_DIR, "induction21_seats.json")));
  const disciplines = rowsOf(await readJson(join(DATA_DIR, "disciplineFullData.json")));

  // specialityId to name. Preferences carry the id, seats carry the name, and
  // without this map the two never meet.
  const specialtyName = new Map(
    Object.entries(MISSING_SPECIALTY_IDS).map(([id, name]) => [Number(id), name])
  );
  for (const discipline of disciplines) {
    for (const s of discipline.specialities ?? []) {
      if (s.specialityId) specialtyName.set(s.specialityId, t(s.specialityName));
    }
  }

  const certPath = join(PORTAL_DIR, "induction21_certificates.json");
  const certificatesByCandidate = existsSync(certPath)
    ? await readJson(certPath)
    : {};

  // Verification. Type 132 (Amendment Process) overrides type 131
  // (Verification Round 01): an amendment is the later ruling on the same
  // candidate, so applying 131 on top would resurrect an overturned outcome.
  const statusPath = join(PORTAL_DIR, "ProfileStatus.json");
  const statusByCandidate = new Map();
  if (existsSync(statusPath)) {
    const profile = await readJson(statusPath);
    const round01 = new Map();
    for (const entry of profile.entries ?? []) {
      const id = Number(entry.applicantId);
      const status = Number(entry.statusId);
      if (Number(entry.statusTypeId) === 132) statusByCandidate.set(id, status);
      else round01.set(id, status);
    }
    for (const [id, status] of round01) {
      if (!statusByCandidate.has(id)) statusByCandidate.set(id, status);
    }
  }

  // ── Seats ───────────────────────────────────────────────────────────────
  const seats = [];
  const seenSeat = new Set();
  let duplicateSeats = 0;

  for (const row of seatRows) {
    const key = [
      t(row.typeName),
      t(row.quotaName),
      t(row.specialityName),
      t(row.hospitalName),
    ].join("|");

    // The unique constraint would reject the whole batch, and a duplicate seat
    // row silently doubles a capacity, so they are counted and dropped here.
    if (seenSeat.has(key)) {
      duplicateSeats++;
      continue;
    }
    seenSeat.add(key);

    seats.push({
      induction: INDUCTION,
      program: t(row.typeName),
      quota: t(row.quotaName),
      specialty: t(row.specialityName),
      hospital: t(row.hospitalName),
      institute: t(row.instituteName) || null,
      seats: Number(row.seats) || 0,
    });
  }

  // ── Candidate inputs ────────────────────────────────────────────────────
  const seatKeys = new Set(
    seats.map((s) => [s.program, s.specialty, s.hospital, s.quota].join("|"))
  );

  const updates = [];
  let unmappedSpecialty = 0;
  let unmatchedPreference = 0;
  let totalPreferences = 0;

  for (const [id, candidate] of Object.entries(candidatesRaw)) {
    const applicantId = Number(id);
    const preferences = [];

    for (const pref of candidate.preferences ?? []) {
      totalPreferences++;

      const specialty = specialtyName.get(pref.specialityId);
      if (!specialty) {
        unmappedSpecialty++;
        continue;
      }

      const program = t(pref.typeName);
      const hospital = t(pref.hospitalName);
      const quota = t(pref.quotaName);

      // A preference naming a seat that does not exist is not an error in the
      // data — seats are withdrawn between the application window and the
      // published capacities. It is dropped, and counted so the number stays
      // visible rather than becoming folklore.
      if (!seatKeys.has([program, specialty, hospital, quota].join("|"))) {
        unmatchedPreference++;
        continue;
      }

      preferences.push({
        preference_no: pref.preferenceNo,
        program,
        program_id: pref.typeId,
        quota,
        specialty,
        specialty_id: pref.specialityId,
        hospital,
        // The bonus for a seat is the best certificate earned in a discipline
        // this preference names, so the ids have to travel with it.
        discipline_ids: pref.disciplineIds ?? [],
        parent_institute: pref.parentInstitute === true,
      });
    }

    preferences.sort((a, b) => a.preference_no - b.preference_no);

    const certs = certificatesByCandidate[String(applicantId)];
    const certificates = (Array.isArray(certs) ? certs : Object.values(certs ?? {})).map(
      (c) => ({
        program_id: c.typeId,
        discipline_id: c.disciplineId,
        marks: c.certificateMarks ?? c.computerizedMarks ?? 0,
      })
    );

    updates.push({
      applicant_id: applicantId,
      marks_total: candidate.marksTotal ?? null,
      preferences,
      certificates,
      profile_status: statusByCandidate.get(applicantId) ?? null,
    });
  }

  console.log(
    `Parsed ${seats.length} seats (${duplicateSeats} duplicates dropped) and ` +
      `${updates.length} candidates.\n` +
      `  ${totalPreferences} preferences read\n` +
      `  ${unmappedSpecialty} dropped — specialty id not in the discipline file\n` +
      `  ${unmatchedPreference} dropped — no such seat in this cycle`
  );

  if (DRY_RUN) {
    console.log("\nDry run — nothing written.");
    return;
  }

  const db = createClient(url, key, { auth: { persistSession: false } });

  // ── Write seats ─────────────────────────────────────────────────────────
  for (let i = 0; i < seats.length; i += BATCH) {
    const slice = seats.slice(i, i + BATCH);
    const { error } = await db
      .from("seats")
      .upsert(slice, { onConflict: "induction,program,quota,specialty,hospital" });
    if (error) throw new Error(`seats: ${error.message}`);
    console.log(`  seats ${i + slice.length}/${seats.length}`);
  }

  // ── Write candidate inputs ──────────────────────────────────────────────
  //
  // One UPDATE per candidate is 3,474 network round trips and does not finish.
  // The batch goes through `apply_portal_inputs`, which unpacks a jsonb payload
  // and applies the whole set in a single statement. That function updates
  // existing rows only: `candidates` holds the people who appear in a merit
  // list, while the source file has every applicant, most of whom never placed.
  let updated = 0;

  for (let i = 0; i < updates.length; i += BATCH) {
    const slice = updates.slice(i, i + BATCH);
    const { data, error } = await db.rpc("apply_portal_inputs", {
      p_induction: INDUCTION,
      p_rows: slice,
    });

    if (error) throw new Error(`candidates: ${error.message}`);

    // Counted by effect. The function returns how many rows it actually
    // touched, because a statement that matched nothing still succeeds.
    updated += data ?? 0;
    console.log(`  candidates ${i + slice.length}/${updates.length} · ${updated} matched`);
  }

  console.log(
    `
Updated ${updated} candidates; ${updates.length - updated} applicants in ` +
      `the source file have no candidate row.`
  );

  // ── Write the allocation pool ───────────────────────────────────────────
  //
  // Every applicant, not just the ones who placed. `candidates` holds 1,453 of
  // this cycle's 3,474 applicants; the other 2,021 applied and never reached a
  // merit list, and they are exactly the competition. An allocation run without
  // them understates how contested every seat is, so every predicted placement
  // comes out optimistic — wrong in the direction people want to believe, which
  // is the worst direction to be wrong in.
  //
  // The rows carry no name and no contact details. `merit_entries` already
  // publishes the name of anyone who placed; the 2,021 who did not have never
  // been published by anyone, and storing their names would put this project's
  // copy ahead of the gazette.
  let pooled = 0;

  for (let i = 0; i < updates.length; i += BATCH) {
    const slice = updates.slice(i, i + BATCH).map((row) => ({
      applicant_id: row.applicant_id,
      marks_total: row.marks_total,
      preferences: row.preferences,
      certificates: row.certificates,
      profile_status: row.profile_status,
    }));

    const { data, error } = await db.rpc("apply_applicant_pool", {
      p_induction: INDUCTION,
      p_rows: slice,
    });

    if (error) throw new Error(`applicants: ${error.message}`);

    pooled += data ?? 0;
    console.log(`  pool ${i + slice.length}/${updates.length} · ${pooled} written`);
  }

  const [{ count: seatCount }, { count: withPreferences }, { count: poolCount }] =
    await Promise.all([
    db.from("seats").select("id", { count: "exact", head: true }).eq("induction", INDUCTION),
    db
      .from("candidates")
      .select("id", { count: "exact", head: true })
      .eq("induction", INDUCTION)
      .neq("preferences", "[]"),
    db
      .from("applicants")
      .select("id", { count: "exact", head: true })
      .eq("induction", INDUCTION),
  ]);

  console.log(
    `In the database now: ${seatCount} seats, ${withPreferences} candidates with a ` +
      `preference list, ${poolCount} applicants in the allocation pool.`
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
