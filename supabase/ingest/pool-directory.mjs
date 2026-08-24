#!/usr/bin/env node
/**
 * Loads the Candidate Pool roster.
 *
 * Input:  ingest/induction21/induction21_candidates.json        (names, preferences)
 *         ingest/induction21/portal/induction21_components.json (marks breakdown)
 *         ingest/induction21/portal/induction21_certificates.json (full records)
 *         ingest/induction21/portal/induction21_revisions.json  (amendments)
 *         ingest/induction21/portal/ProfileStatus.json          (verification)
 *         public/data/disciplineFullData.json                   (specialty names)
 *
 * Output: public.pool_directory
 *
 * ── What this writes that nothing else does ──────────────────────────────
 *
 * Names, for all 3,474 applicants rather than only the 1,453 the gazette has
 * published. That is a widening of the project's tier split, authorised
 * explicitly by the owner, and the table it lands in is gated on
 * `private.is_verified()`. See the migration for the full reasoning.
 *
 * ── What this deliberately does NOT write ────────────────────────────────
 *
 * CNIC, email address, contact number, father's name. Every one of them is on
 * the source records and none is read here, because the original's own
 * Candidate Pool modal does not show them either. A faithful port has no use
 * for them and Tier 2 keeps them.
 *
 * ── Running it ───────────────────────────────────────────────────────────
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   SUPABASE_INGEST_ALLOW_PROJECT=<project-ref> \
 *   node supabase/ingest/pool-directory.mjs [--dry-run]
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const INGEST_DIR = join(process.cwd(), "ingest", "induction21");
const PORTAL_DIR = join(INGEST_DIR, "portal");
const DATA_DIR = join(process.cwd(), "public", "data");
const INDUCTION = 21;

/**
 * Rows per RPC call.
 *
 * Preference lists run to 358 entries, so a batch carries far more jsonb than
 * the row count suggests. 250 keeps each request comfortably under the
 * statement timeout; the applicants ingest learned the same lesson the hard
 * way at one round trip per candidate.
 */
const BATCH = 250;

const DRY_RUN = process.argv.includes("--dry-run");

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const rowsOf = (raw) =>
  Array.isArray(raw) ? raw : (raw?.Table ?? Object.values(raw ?? {}));
const t = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * Parentage, as the portal writes it into the name field.
 *
 * Every one of the 3,474 records has it: 2,119 `D/O`, 1,351 `S/O`, 4 `Bint`.
 * The gazette does not — all 1,219 names in the round 8 merit list are clean —
 * so ingesting `nameFull` verbatim would have this project publishing 3,474
 * fathers' and guardians' names that nobody else has published, in the one
 * table every verified user can read.
 *
 * Father's name is Tier 2 and stays there. The name kept here is the part
 * before the marker, which is the name the gazette prints.
 */
const PARENTAGE = /\s+(?:D\/O|S\/O|W\/O|C\/O|Bint|Binte)\s+.*$/i;

const withoutParentage = (v) => t(v).replace(PARENTAGE, "").trim();

/**
 * A CNIC, in the shape the national identity number takes.
 *
 * Three candidates typed theirs into the portal's name box, and their whole
 * `nameFull` is the number and nothing else. Ingesting that verbatim would put
 * three CNICs into the one table every verified user can read, under a column
 * labelled "Name" — the single worst field in the original leak, arriving
 * through a data-entry mistake rather than through a design decision.
 */
const CNIC = /\d{5}-\d{7}-\d/;

/**
 * The name to display, or null when there isn't one.
 *
 * Null is rendered as "Applicant 38297", which is the honest outcome: the
 * gazette has never named these people, and a number typed into a name box is
 * not a name. Anything with no letter at all is treated the same way, so the
 * next variant of this mistake does not need a new rule.
 */
const displayName = (v) => {
  const name = withoutParentage(v);
  if (!name) return null;
  if (CNIC.test(name)) return null;
  if (!/\p{L}/u.test(name)) return null;
  return name;
};
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Specialty ids absent from the discipline file but present in preferences.
 *
 * Kept in step with `supabase/ingest/portal-inputs.mjs` and
 * `src/lib/portal/cascade.ts`, spellings included — these are how the PHF
 * portal writes them, and correcting any one copy would stop preferences
 * joining to the seat rows they have to match.
 */
const MISSING_SPECIALTY_IDS = {
  63: "Physical Medicine & Rehablitation",
  69: "Nuclear Medicine",
  70: "Immunology",
  71: "Virology",
};

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
        `This loads 3,474 real doctors' names and preference lists into a table\n` +
        `every verified user can read. Set SUPABASE_INGEST_ALLOW_PROJECT=${ref}\n` +
        `to confirm that is the project you mean.`
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

  const candidates = rowsOf(await readJson(candidatesPath));
  const disciplines = rowsOf(await readJson(join(DATA_DIR, "disciplineFullData.json")));

  // specialityId to name. Preferences carry the id; the roster shows the name.
  const specialtyName = new Map(
    Object.entries(MISSING_SPECIALTY_IDS).map(([id, name]) => [Number(id), name])
  );
  for (const discipline of disciplines) {
    for (const s of discipline.specialities ?? []) {
      if (s.specialityId) specialtyName.set(s.specialityId, t(s.specialityName));
    }
  }

  const optional = async (name) => {
    const path = join(PORTAL_DIR, name);
    return existsSync(path) ? await readJson(path) : {};
  };

  const componentsById = await optional("induction21_components.json");
  const certificatesById = await optional("induction21_certificates.json");
  const revisionsById = await optional("induction21_revisions.json");

  // Verification. Type 132 (Amendment Process) overrides type 131
  // (Verification Round 01): an amendment is the later ruling on the same
  // candidate, so applying 131 on top would resurrect an overturned outcome.
  // Identical to `portal-inputs.mjs`, deliberately — the roster must agree with
  // the pool the engine runs on, or the same person reads as cleared on one
  // page and rejected on another.
  const statusPath = join(PORTAL_DIR, "ProfileStatus.json");
  const statusById = new Map();
  if (existsSync(statusPath)) {
    const profile = await readJson(statusPath);
    const round01 = new Map();
    for (const entry of profile.entries ?? []) {
      const id = Number(entry.applicantId);
      const status = Number(entry.statusId);
      if (Number(entry.statusTypeId) === 132) statusById.set(id, status);
      else round01.set(id, status);
    }
    for (const [id, status] of round01) {
      if (!statusById.has(id)) statusById.set(id, status);
    }
  }

  // ── Shape ───────────────────────────────────────────────────────────────
  let missingSpecialty = 0;

  const rows = candidates.map((candidate) => {
    const applicantId = Number(candidate.applicantId);

    const preferences = (candidate.preferences ?? []).map((p) => {
      const specialty = specialtyName.get(p.specialityId) ?? "";
      if (!specialty) missingSpecialty += 1;
      return {
        preference_no: Number(p.preferenceNo ?? 0),
        program: t(p.typeName),
        program_id: p.typeId ?? null,
        quota: t(p.quotaName),
        specialty,
        specialty_id: p.specialityId ?? null,
        hospital: t(p.hospitalName),
        institute: t(p.instituteName) || null,
        discipline_ids: p.disciplineIds ?? [],
        parent_institute: p.parentInstitute ?? 0,
      };
    });

    return {
      applicant_id: applicantId,
      // Read explicitly, one field at a time. A spread of the source record
      // would carry cnic, emailId and contactNumber straight into a table every
      // verified user can read.
      name_full: displayName(candidate.nameFull),
      pmdc_no: t(candidate.pmdcNo) || null,
      marks_total: num(candidate.marksTotal),
      profile_status: statusById.get(applicantId) ?? null,
      applied_in: candidate.applied_in ?? {},
      components: componentsById[String(applicantId)] ?? {},
      preferences,
      certificates: certificatesById[String(applicantId)] ?? [],
      revisions: revisionsById[String(applicantId)] ?? {},
    };
  });

  const stripped = candidates.filter((c) => PARENTAGE.test(t(c.nameFull))).length;
  const suppressed = candidates.filter(
    (c) => t(c.nameFull) && displayName(c.nameFull) === null
  ).length;
  const named = rows.filter((r) => r.name_full).length;
  const withComponents = rows.filter((r) => Object.keys(r.components).length).length;
  const withCertificates = rows.filter((r) => r.certificates.length).length;
  const withRevisions = rows.filter((r) => Object.keys(r.revisions).length).length;
  const cleared = rows.filter((r) => r.profile_status === 1).length;

  console.log(
    `pool_directory: ${rows.length} rows\n` +
      `  named          ${named}\n` +
      `  components     ${withComponents}\n` +
      `  certificates   ${withCertificates}\n` +
      `  revisions      ${withRevisions}\n` +
      `  cleared (1)    ${cleared}\n` +
      `  preferences    ${rows.reduce((sum, r) => sum + r.preferences.length, 0)}
` +
      `  parentage cut  ${stripped}
` +
      `  name withheld  ${suppressed}   (CNIC or no letters in the name field)`
  );

  if (missingSpecialty) {
    // Loud rather than silent: a preference with no specialty name renders as a
    // blank row in the modal, and the cause is always a discipline file that
    // has moved on without `MISSING_SPECIALTY_IDS` being updated.
    console.warn(
      `  WARNING: ${missingSpecialty} preferences have no specialty name — ` +
        `check MISSING_SPECIALTY_IDS against public/data/disciplineFullData.json`
    );
  }

  // Guard rails, not decoration. If any of these fire the source files are not
  // what this script was written against, and writing anyway would half-fill a
  // table people read as authoritative.
  if (rows.length < 3000) {
    console.error(`Refusing to write: only ${rows.length} rows — expected the whole pool.`);
    process.exit(1);
  }
  // Counts names the source HAS, so deliberate suppression cannot trip it —
  // the guard exists to catch a source file that stopped carrying names, not to
  // second-guess a name this script decided not to publish.
  const sourceNamed = candidates.filter((c) => t(c.nameFull)).length;
  if (sourceNamed < candidates.length * 0.9) {
    console.error(
      `Refusing to write: only ${sourceNamed} of ${candidates.length} source records have a name.`
    );
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log("\nDry run — nothing written.");
    return;
  }

  // ── Write ───────────────────────────────────────────────────────────────
  const db = createClient(url, key, { auth: { persistSession: false } });

  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { data, error } = await db.rpc("apply_pool_directory", {
      p_induction: INDUCTION,
      p_rows: batch,
    });
    if (error) {
      console.error(`apply_pool_directory failed at row ${i}: ${error.message}`);
      process.exit(1);
    }
    written += data ?? 0;
    process.stdout.write(`\r  written ${written}/${rows.length}`);
  }

  console.log(`\nDone. ${written} rows in pool_directory.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
