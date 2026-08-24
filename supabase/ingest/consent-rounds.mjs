#!/usr/bin/env node
/**
 * Loads PHF consent-round exports into the two-tier candidate model.
 *
 * Input:  ingest/induction21/induction21_consent_round<N>.json
 * Output: public.merit_entries  (Tier 1 — gazette-equivalent)
 *         public.candidates     (Tier 2 — contact details)
 *
 * ── The split is the whole point ──────────────────────────────────────────
 *
 * Each source row mixes both tiers. The mobile number sits in the same object
 * as the name and the marks, and the original site shipped that object whole to
 * the browser. Here the row is taken apart at WRITE time:
 *
 *   name, applicant id, marks, programme, specialty, hospital, quota,
 *   preference, consent status        → merit_entries, readable by any
 *                                       verified signed-in user
 *   contact number                    → candidates, readable only by the
 *                                       linked candidate and by staff
 *
 * `merit_entries` has no column for a phone number, so the split is enforced by
 * the schema rather than by this script remembering to omit it.
 *
 * ── Running it ────────────────────────────────────────────────────────────
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   SUPABASE_INGEST_ALLOW_PROJECT=<project-ref> \
 *   node supabase/ingest/consent-rounds.mjs [--dry-run]
 *
 * The project guard is deliberate and mirrors the seed script: this writes real
 * people's names and mobile numbers, and running it against the wrong project
 * is not an error you can undo by deleting rows.
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const INGEST_DIR = join(process.cwd(), "ingest", "induction21");
const INDUCTION = 21;
const BATCH = 500;

const DRY_RUN = process.argv.includes("--dry-run");

/**
 * `infoTitle` is the only place the specialty and hospital appear, as a single
 * hyphen-joined string:
 *
 *   "FCPS - Punjab - Ophthalmology - <university> - <hospital>"
 *    prog   quota    specialty       parent inst.  hospital
 *
 * Hospital names legitimately contain hyphens ("Nishtar-II Hospital Multan"),
 * so this splits on " - " with spaces and takes the LAST field as the hospital
 * rather than assuming a field count.
 */
function parseInfoTitle(infoTitle) {
  const parts = String(infoTitle ?? "")
    .split(" - ")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length < 5) return null;

  return {
    program: parts[0],
    quota: parts[1],
    specialty: parts[2],
    parentInstitute: parts.slice(3, -1).join(" - "),
    hospital: parts[parts.length - 1],
  };
}

/** Rounds are identified by the filename, not by anything inside the file. */
function roundFromFilename(name) {
  const match = name.match(/consent_round(\d+)(_bk\d*)?\.json$/i);
  if (!match) return null;
  // `_bk` files are backups of a round that was re-exported. Skipped: loading
  // both would double-count a round under the same unique key and the second
  // write would silently overwrite the first.
  if (match[2]) return null;
  return Number(match[1]);
}

function normalise(value) {
  return typeof value === "string" ? value.trim() : value;
}

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
        `This loads real candidate names and mobile numbers. Set\n` +
        `SUPABASE_INGEST_ALLOW_PROJECT=${ref} to confirm that is the project you mean.`
    );
    process.exit(1);
  }

  const files = (await readdir(INGEST_DIR))
    .filter((f) => f.endsWith(".json"))
    .sort();

  /**
   * Optional enrichment from the full candidate export.
   *
   * The consent rounds carry no PMDC number — only the candidate export does —
   * so without this the merit list shows a dash in a column the official list
   * fills. PMDC is Tier 1 by deliberate decision (the original published it and
   * made it searchable), so it is copied into `merit_entries`. CNIC and email
   * are Tier 2 and go no further than `candidates`.
   */
  let enrichment = new Map();
  try {
    const raw = JSON.parse(
      await readFile(join(INGEST_DIR, "induction21_candidates.json"), "utf8")
    );
    const rows = Array.isArray(raw) ? raw : Object.values(raw);
    for (const row of rows) {
      const id = Number(row.applicantId);
      if (Number.isFinite(id)) enrichment.set(id, row);
    }
    console.log(`enrichment: ${enrichment.size} records with PMDC / CNIC / email`);
  } catch {
    console.log("enrichment: induction21_candidates.json not present, skipping");
  }

  /** applicant_id → the Tier 2 record, merged across every round. */
  const candidates = new Map();
  const entries = [];
  let skippedRounds = 0;
  let unparsed = 0;

  for (const file of files) {
    const round = roundFromFilename(file);
    if (round == null) {
      skippedRounds++;
      continue;
    }

    const raw = JSON.parse(await readFile(join(INGEST_DIR, file), "utf8"));
    const rows = Array.isArray(raw) ? raw : Object.values(raw)[0];

    for (const row of rows) {
      const parsed = parseInfoTitle(row.infoTitle);
      if (!parsed) {
        unparsed++;
        continue;
      }

      const applicantId = Number(row.applicantId);
      if (!Number.isFinite(applicantId)) {
        unparsed++;
        continue;
      }

      const name = normalise(row.name);
      const marks = Number(row.marks);
      const extra = enrichment.get(applicantId);

      // Tier 1. No contact field exists on this shape by design.
      entries.push({
        induction: INDUCTION,
        round,
        applicant_id: applicantId,
        name_full: name,
        pmdc_no: normalise(extra?.pmdcNo) ?? null,
        marks_total: Number.isFinite(marks) ? marks : null,
        program: normalise(row.program) || parsed.program,
        specialty: parsed.specialty,
        hospital: parsed.hospital,
        quota: normalise(row.quota) || parsed.quota,
        preference_no: Number(row.preferenceNo) || null,
        consent_status: normalise(row.status) ?? null,
        row_no: Number(row.rowNo) || null,
      });

      // Tier 2. Later rounds win for the mutable fields, since a candidate's
      // marks and preference can change between rounds while identity cannot.
      const existing = candidates.get(applicantId);
      candidates.set(applicantId, {
        applicant_id: applicantId,
        induction: INDUCTION,
        name_full: name,
        pmdc_no: normalise(extra?.pmdcNo) ?? existing?.pmdc_no ?? null,
        cnic: normalise(extra?.cnic) ?? existing?.cnic ?? null,
        email_id: normalise(extra?.emailId) ?? existing?.email_id ?? null,
        contact_number: normalise(row.number) ?? existing?.contact_number ?? null,
        marks_total: Number.isFinite(marks) ? marks : (existing?.marks_total ?? null),
        preferences: [
          ...(existing?.preferences ?? []),
          {
            round,
            preference_no: Number(row.preferenceNo) || null,
            program: normalise(row.program) || parsed.program,
            specialty: parsed.specialty,
            hospital: parsed.hospital,
            quota: normalise(row.quota) || parsed.quota,
            parent_institute: parsed.parentInstitute,
            consent_status: normalise(row.status) ?? null,
          },
        ],
      });
    }
  }

  const withPhone = [...candidates.values()].filter(
    (c) => c.contact_number
  ).length;

  console.log(
    `Parsed ${entries.length} merit entries across ${files.length - skippedRounds} rounds\n` +
      `  distinct candidates : ${candidates.size}\n` +
      `  with a contact no.  : ${withPhone}\n` +
      `  unparsable rows     : ${unparsed}\n` +
      `  backup files skipped: ${skippedRounds}`
  );

  if (DRY_RUN) {
    console.log("\n--dry-run: nothing written.");
    return;
  }

  const db = createClient(url, key, { auth: { persistSession: false } });

  // Tier 2 first: `candidate_links` references it, and a merit entry with no
  // candidate behind it is less useful than the reverse.
  const candidateRows = [...candidates.values()];
  for (let i = 0; i < candidateRows.length; i += BATCH) {
    const slice = candidateRows.slice(i, i + BATCH);
    const { error } = await db
      .from("candidates")
      .upsert(slice, { onConflict: "induction,applicant_id" });
    if (error) throw new Error(`candidates upsert failed: ${error.message}`);
    console.log(`  candidates ${i + slice.length}/${candidateRows.length}`);
  }

  for (let i = 0; i < entries.length; i += BATCH) {
    const slice = entries.slice(i, i + BATCH);
    const { error } = await db.from("merit_entries").upsert(slice, {
      onConflict: "induction,round,applicant_id,program,specialty,hospital",
    });
    if (error) throw new Error(`merit_entries upsert failed: ${error.message}`);
    console.log(`  merit_entries ${i + slice.length}/${entries.length}`);
  }

  // Checked by effect, not by status: PostgREST returns 204 with zero rows
  // affected when a write is silently dropped, so counting is the only proof.
  const [{ count: entryCount }, { count: candidateCount }] = await Promise.all([
    db
      .from("merit_entries")
      .select("id", { count: "exact", head: true })
      .eq("induction", INDUCTION),
    db
      .from("candidates")
      .select("id", { count: "exact", head: true })
      .eq("induction", INDUCTION),
  ]);

  console.log(
    `\nIn the database now: ${entryCount} merit entries, ${candidateCount} candidates.`
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
