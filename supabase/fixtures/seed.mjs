/**
 * Seeds the database with synthetic fixtures.
 *
 * Uses the service_role key, which bypasses every RLS policy — that is the
 * point (only the pipeline writes candidates and merit_entries), and also why
 * this script is guarded.
 *
 * Creates:
 *   - candidates          (tier 2, private)
 *   - merit_entries       (tier 1, gazette-equivalent, derived from preferences)
 *   - four auth users     two candidates, one super_admin, one moderator
 *   - candidate_links     linking each test candidate to their record
 *   - user_roles          for the two staff accounts
 *
 * Usage:  npm run seed
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const here = dirname(fileURLToPath(import.meta.url));

// Load .env.local without adding a dependency.
for (const line of readFileSync(join(here, "..", "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

// --- guard -------------------------------------------------------------------
// This script writes fake people with fake CNICs. Running it against a database
// holding real candidates would corrupt real records, and the service_role key
// means RLS will not stop it. Require an explicit opt-in naming the target.
const projectRef = new URL(url).hostname.split(".")[0];
const allowed = process.env.SUPABASE_SEED_ALLOW_PROJECT;

if (allowed !== projectRef) {
  console.error(
    `Refusing to seed.\n\n` +
      `  target project : ${projectRef}\n` +
      `  SUPABASE_SEED_ALLOW_PROJECT : ${allowed ?? "(unset)"}\n\n` +
      `This writes synthetic candidates using the service_role key, which\n` +
      `bypasses RLS. To confirm the target is a development project, run:\n\n` +
      `  SUPABASE_SEED_ALLOW_PROJECT=${projectRef} npm run seed\n`
  );
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** The cycle these fixtures represent. */
const INDUCTION = 21;

const candidates = JSON.parse(readFileSync(join(here, "candidates.json"), "utf8"));
const ids = Object.keys(candidates);

// --- tier 2: private candidate records ---------------------------------------

const candidateRows = ids.map((id) => {
  const c = candidates[id];
  return {
    applicant_id: c.applicantId,
    name_full: c.nameFull,
    pmdc_no: c.pmdcNo,
    cnic: c.cnic,
    email_id: c.emailId,
    contact_number: c.contactNumber,
    marks_total: c.marksTotal,
    applied_in: c.applied_in,
    preferences: c.preferences,
    induction: INDUCTION,
  };
});

// Chunked: a single insert of thousands of rows with jsonb preference lists can
// exceed the request size limit.
const CHUNK = 200;
for (let i = 0; i < candidateRows.length; i += CHUNK) {
  const { error } = await db
    .from("candidates")
    .upsert(candidateRows.slice(i, i + CHUNK), { onConflict: "induction,applicant_id" });
  if (error) throw new Error(`candidates upsert failed: ${error.message}`);
}
console.log(`seeded ${candidateRows.length} candidates (tier 2, private)`);

// --- tier 1: gazette-equivalent projection -----------------------------------
// Built by PROJECTING the private records: only the gazette-published columns
// are carried across. CNIC, email and phone are never copied. This is the split
// that the original site failed to make — it shipped one file with everything
// and relied on the UI not to render the private fields.

const meritRows = [];
for (const id of ids) {
  const c = candidates[id];
  for (const pref of c.preferences) {
    meritRows.push({
      induction: INDUCTION,
      round: 1,
      applicant_id: c.applicantId,
      name_full: c.nameFull,
      pmdc_no: c.pmdcNo,
      marks_total: c.marksTotal,
      effective_mark: pref.marks,
      program: pref.typeName,
      specialty: pref.specialityName,
      hospital: pref.hospitalName,
      quota: pref.quotaName,
      preference_no: pref.preferenceNo,
    });
  }
}

// The generator picks preferences from real seat combos, so the same candidate
// can appear twice for one (program, specialty, hospital). Deduplicate to match
// the table's unique constraint.
const seen = new Set();
const uniqueMerit = meritRows.filter((r) => {
  const key = `${r.induction}|${r.round}|${r.applicant_id}|${r.program}|${r.specialty}|${r.hospital}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

for (let i = 0; i < uniqueMerit.length; i += CHUNK) {
  const { error } = await db
    .from("merit_entries")
    .upsert(uniqueMerit.slice(i, i + CHUNK), {
      onConflict: "induction,round,applicant_id,program,specialty,hospital",
    });
  if (error) throw new Error(`merit_entries upsert failed: ${error.message}`);
}
console.log(`seeded ${uniqueMerit.length} merit entries (tier 1, gazette-equivalent)`);

// --- accounts ----------------------------------------------------------------

/** Development-only password. No real credential appears in this repository. */
const DEV_PASSWORD = "devpassword123!";

async function ensureUser({ email, displayName, role, applicantId }) {
  // Remove any previous run's account so the script is re-runnable.
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users?.find((u) => u.email === email);
  if (existing) await db.auth.admin.deleteUser(existing.id);

  const { data, error } = await db.auth.admin.createUser({
    email,
    password: DEV_PASSWORD,
    // Pre-confirmed: private.is_verified() reads email_confirmed_at, and both
    // tiers are unreadable without it.
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error) throw new Error(`createUser(${email}) failed: ${error.message}`);

  const userId = data.user.id;

  if (role) {
    const { error: roleError } = await db
      .from("user_roles")
      .upsert({ user_id: userId, role, granted_by: null });
    if (roleError) throw new Error(`role grant failed: ${roleError.message}`);
  }

  if (applicantId) {
    // Links point at the surrogate key: applicant ids repeat across inductions
    // and belong to different people each cycle, so the pair resolves the row.
    const { data: candidate } = await db
      .from("candidates")
      .select("id")
      .eq("applicant_id", Number(applicantId))
      .eq("induction", INDUCTION)
      .maybeSingle();

    if (!candidate) throw new Error(`no candidate ${applicantId} in induction ${INDUCTION}`);

    const { error: linkError } = await db
      .from("candidate_links")
      .upsert({ user_id: userId, candidate_id: candidate.id, linked_by: "seed" },
              { onConflict: "candidate_id" });
    if (linkError) throw new Error(`link failed: ${linkError.message}`);
  }

  await db.from("profiles").upsert({
    user_id: userId,
    display_name: displayName,
    is_public: true,
  });

  return userId;
}

const first = candidates[ids[0]];
const second = candidates[ids[1]];

await ensureUser({
  email: first.emailId,
  displayName: first.nameFull,
  applicantId: first.applicantId,
});
await ensureUser({
  email: second.emailId,
  displayName: second.nameFull,
  applicantId: second.applicantId,
});
await ensureUser({
  email: "admin@example.invalid",
  displayName: "Dev Admin",
  role: "super_admin",
});
await ensureUser({
  email: "moderator@example.invalid",
  displayName: "Dev Moderator",
  role: "moderator",
});

console.log(`\nseeded accounts (password for all: ${DEV_PASSWORD})`);
console.log(`  ${first.emailId}   candidate, linked to ${first.applicantId}`);
console.log(`  ${second.emailId}   candidate, linked to ${second.applicantId}`);
console.log(`  admin@example.invalid        super_admin`);
console.log(`  moderator@example.invalid    moderator`);
