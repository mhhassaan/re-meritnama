/**
 * Access-control tests, run against the real REST API.
 *
 * Deliberately end-to-end over HTTP rather than SQL: the thing that must hold
 * is what an attacker gets from the public endpoint, and only this path
 * exercises PostgREST, the grants, and the RLS policies together. The original
 * project's data was reachable at exactly this layer.
 *
 * Requires the database to be seeded (npm run seed).
 *
 * Usage:  npm run test:rls
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

for (const line of readFileSync(join(here, "..", "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!BASE || !KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and a publishable/anon key must be set.");
  process.exit(1);
}

const DEV_PASSWORD = "devpassword123!";

// Used only to tidy up rows this suite created. Never to assert anything: the
// service role bypasses RLS, so a check made with it proves nothing about what
// the public endpoint allows.
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
let passed = 0;
let failed = 0;

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.error(`  FAIL  ${name}\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function signIn(email) {
  const res = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: DEV_PASSWORD }),
  });
  const body = await res.json();
  if (!body.access_token) throw new Error(`sign-in failed for ${email}: ${JSON.stringify(body)}`);
  return body.access_token;
}

/** Returns { status, rows } — rows is null when the request was rejected. */
async function get(path, token) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${token ?? KEY}`,
    },
  });
  const status = res.status;
  let rows = null;
  try {
    const parsed = await res.json();
    rows = Array.isArray(parsed) ? parsed : null;
  } catch {
    /* non-JSON body */
  }
  return { status, rows };
}

console.log("\nanonymous caller (publishable key only)");
for (const table of [
  "candidates",
  "merit_entries",
  "user_roles",
  "candidate_links",
  "access_requests",
  "profiles",
  "access_logs",
  "screenshot_logs",
  "seats",
  "cascade_inputs",
  "applicants",
  "pool_directory",
  "joining_status",
  "data_changes",
  "data_change_runs",
]) {
  const { status } = await get(`${table}?select=*&limit=1`);
  check(`anon cannot read ${table}`, status, 401);
}

const candidateToken = await signIn("candidate00001@example.invalid");

// The linked applicant id is discovered, not hardcoded. It used to be the
// fixture 900001; once real records were ingested the dev account was relinked
// to a real candidate, and the hardcoded id turned a passing security assertion
// into a false failure. Asking the database what this user can see is also the
// truer test — it is exactly the question RLS answers.
const own = await get("candidates?select=applicant_id,cnic", candidateToken);
const OWN_APPLICANT = own.rows?.[0]?.applicant_id;

console.log(`\nsigned-in candidate (linked to ${OWN_APPLICANT ?? "nothing"})`);

const tier1 = await get("merit_entries?select=id&limit=5", candidateToken);
check("can read tier 1 merit entries", tier1.rows?.length > 0, true);

check("can read own candidate record", own.rows?.length, 1);

// Someone else's id, taken from tier 1 — which this candidate CAN read — so the
// row is guaranteed to exist. That is what makes the denial below meaningful:
// it proves RLS hid the record rather than the record being absent.
const someoneElse = await get(
  `merit_entries?select=applicant_id&applicant_id=neq.${OWN_APPLICANT}&limit=1`,
  candidateToken
);
const OTHER_APPLICANT = someoneElse.rows?.[0]?.applicant_id;

const other = await get(
  `candidates?applicant_id=eq.${OTHER_APPLICANT}&select=applicant_id,cnic`,
  candidateToken
);
check("cannot read another candidate record", other.rows?.length, 0);

const enumerate = await get("candidates?select=applicant_id&limit=500", candidateToken);
check("cannot enumerate candidates", enumerate.rows?.length, 1);

// The tier 1 projection must not carry private columns. Checked on real data
// rather than by reading the schema, since the seed builds this table.
const shape = await get("merit_entries?select=*&limit=1", candidateToken);
const PRIVATE = ["cnic", "email_id", "contact_number", "father_name"];
const leaked = Object.keys(shape.rows?.[0] ?? {}).filter((k) => PRIVATE.includes(k));
check("tier 1 exposes no private columns", leaked, []);

console.log("\nwrite attempts by a signed-in candidate");
async function write(path, body, token, method = "POST") {
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.status;
}

check(
  "cannot self-grant a role",
  (await write("user_roles", { user_id: "00000000-0000-0000-0000-000000000001", role: "super_admin" }, candidateToken)) >= 400,
  true
);
check(
  "cannot insert merit entries",
  (await write("merit_entries", { round: 1, applicant_id: 999999, name_full: "X", program: "FCPS", specialty: "A", hospital: "B", quota: "Punjab" }, candidateToken)) >= 400,
  true
);
check(
  "cannot forge a candidate link",
  (await write("candidate_links", { user_id: "00000000-0000-0000-0000-000000000001", applicant_id: 900002 }, candidateToken)) >= 400,
  true
);
check(
  "cannot edit own PII",
  (await write(`candidates?applicant_id=eq.${OWN_APPLICANT}`, { cnic: "tampered" }, candidateToken, "PATCH")) >= 400,
  true
);

// The admin console's write actions re-check the caller's role in application
// code, but that check lives in a Server Action — a public endpoint. These
// assert the database refuses the same operations regardless, so a bypass of the
// application check is not sufficient on its own.
console.log("\naccess request moderation by a non-staff user");
const adminTokenForPeek = await signIn("admin@example.invalid");

// Checked by EFFECT, not by status code. When RLS hides the target row,
// PostgREST returns 204 with zero rows affected — a success status for a write
// that did nothing. Asserting on the status alone would report a real breach as
// a pass, which is exactly the mistake an earlier version of this suite made.
{
  const staffPeek = async () => {
    const r = await get(
      "access_requests?email=eq.candidate00005@example.invalid&select=status",
      adminTokenForPeek
    );
    return r.rows?.[0]?.status ?? null;
  };

  const before = await staffPeek();
  await write(
    "access_requests?email=eq.candidate00005@example.invalid",
    { status: "approved" },
    candidateToken,
    "PATCH"
  );
  const after = await staffPeek();

  check("candidate cannot approve someone else's request", after, before);
}
const otherRequests = await get(
  "access_requests?select=email&limit=100",
  candidateToken
);
check(
  "candidate cannot list other people's requests",
  (otherRequests.rows ?? []).every((r) => r.email === "candidate00001@example.invalid"),
  true
);

// Payment proofs are bank screenshots — sender name, account number, balance,
// recent transactions. The bucket is private with NO client policies at all, so
// these assert that absence rather than a particular policy's wording.
console.log("\npayment proof storage");
{
  const OBJECT = "21/probe/nonexistent.png";

  const publicUrl = await fetch(
    `${BASE}/storage/v1/object/public/payment-proofs/${OBJECT}`
  );
  check("bucket is not public", publicUrl.status >= 400, true);

  const anonRead = await fetch(`${BASE}/storage/v1/object/payment-proofs/${OBJECT}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  check("anon cannot read an object", anonRead.status >= 400, true);

  const candidateRead = await fetch(
    `${BASE}/storage/v1/object/payment-proofs/${OBJECT}`,
    { headers: { apikey: KEY, Authorization: `Bearer ${candidateToken}` } }
  );
  check("signed-in candidate cannot read an object", candidateRead.status >= 400, true);

  // Listing is checked separately from reading: a bucket that denies reads but
  // permits listing still leaks who has paid, and every filename here contains
  // an email address.
  const listRes = await fetch(`${BASE}/storage/v1/object/list/payment-proofs`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${candidateToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefix: "", limit: 100 }),
  });
  const listed = await listRes.json().catch(() => null);
  check(
    "candidate cannot list the bucket",
    Array.isArray(listed) ? listed.length : "not-an-array",
    0
  );

  const candidateUpload = await fetch(
    `${BASE}/storage/v1/object/payment-proofs/21/probe/injected.png`,
    {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${candidateToken}`,
        "Content-Type": "image/png",
      },
      body: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    }
  );
  check("candidate cannot upload directly", candidateUpload.status >= 400, true);
}

// Avatars are photographs of people's faces, keyed to a display name and a
// cycle. The bucket is private, and the select policy is scoped to the
// uploader's own folder — so the interesting assertions are that no public URL
// works and that a signed-in candidate cannot reach anybody else's folder.
console.log("\navatar storage");
{
  const OTHER = "00000000-0000-0000-0000-000000000000/avatar";

  const publicUrl = await fetch(`${BASE}/storage/v1/object/public/avatars/${OTHER}`);
  check("avatars bucket is not public", publicUrl.status >= 400, true);

  const anonRead = await fetch(`${BASE}/storage/v1/object/avatars/${OTHER}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  check("anon cannot read an avatar", anonRead.status >= 400, true);

  const otherRead = await fetch(`${BASE}/storage/v1/object/avatars/${OTHER}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${candidateToken}` },
  });
  check("a candidate cannot read another user's avatar", otherRead.status >= 400, true);

  // Minting is checked separately from reading. The whole design is that other
  // people's photos reach a browser only through a server-minted signed URL, so
  // a client able to mint its own would make the private bucket decorative.
  const sign = await fetch(`${BASE}/storage/v1/object/sign/avatars/${OTHER}`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${candidateToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: 60 }),
  });
  check("a candidate cannot sign another user's avatar", sign.status >= 400, true);

  // Listing separately again: a bucket that denies reads but permits listing
  // still discloses which accounts have uploaded a photo.
  //
  // Unlike payment-proofs, the expected answer is NOT zero. The select policy
  // is scoped to the caller's own folder — `upsert` needs a readable row, see
  // the migration — so listing returns exactly one entry, theirs. What must
  // hold is that nobody else's folder is in it.
  const ownUid = JSON.parse(
    Buffer.from(candidateToken.split(".")[1], "base64url").toString()
  ).sub;

  const listRes = await fetch(`${BASE}/storage/v1/object/list/avatars`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${candidateToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefix: "", limit: 100 }),
  });
  const listed = await listRes.json().catch(() => null);
  const foreign = Array.isArray(listed)
    ? listed.map((e) => e.name).filter((n) => n !== ownUid)
    : ["not-an-array"];
  check("listing the avatars bucket shows nobody else's folder", foreign, []);

  const otherUpload = await fetch(`${BASE}/storage/v1/object/avatars/${OTHER}`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${candidateToken}`,
      "Content-Type": "image/png",
    },
    body: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  });
  check(
    "a candidate cannot upload into another user's folder",
    otherUpload.status >= 400,
    true
  );

  const otherDelete = await fetch(`${BASE}/storage/v1/object/avatars/${OTHER}`, {
    method: "DELETE",
    headers: { apikey: KEY, Authorization: `Bearer ${candidateToken}` },
  });
  check(
    "a candidate cannot delete another user's avatar",
    otherDelete.status >= 400,
    true
  );
}

console.log("\nportal allocation inputs");
{
  // Seats are capacities and names — no personal data — and every candidate
  // needs to read all of them to make sense of any allocation.
  const seats = await get(
    "seats?select=program,quota,specialty,hospital,seats&limit=5",
    candidateToken
  );
  check("a verified candidate can read seat capacities", seats.rows?.length > 0, true);

  const seatShape = await get("seats?select=*&limit=1", candidateToken);
  const seatColumns = Object.keys(seatShape.rows?.[0] ?? {});
  check(
    "the seats table carries no personal column",
    seatColumns.filter((c) =>
      ["applicant_id", "name_full", "cnic", "email_id", "contact_number"].includes(c)
    ),
    []
  );

  // `cascade_inputs` is security_invoker, so it inherits `candidates`' policies.
  // A candidate reading it must see exactly their own row. The point of the
  // view is that the SERVICE ROLE can read all of it without ever touching
  // contact details — not that everyone can read everyone.
  const inputs = await get("cascade_inputs?select=applicant_id&limit=500", candidateToken);
  check("cascade_inputs exposes only the caller's own row", inputs.rows?.length, 1);
  check("and it is the caller's own", inputs.rows?.[0]?.applicant_id, OWN_APPLICANT);

  // The view's entire justification is its column list. If a name or a contact
  // number ever appears in it, running the engine with the service role becomes
  // a contact-data leak rather than a wrong number.
  const inputShape = await get("cascade_inputs?select=*&limit=1", candidateToken);
  const inputColumns = Object.keys(inputShape.rows?.[0] ?? {});
  check(
    "cascade_inputs carries no identifying column",
    inputColumns.filter((c) =>
      ["name_full", "cnic", "email_id", "contact_number", "father_name", "pmdc_no"].includes(c)
    ),
    []
  );

  // Writes. The ingest pipeline owns both of these. A signed-in user owning
  // either could invent seats or rewrite a preference list, and a preference
  // list decides where someone is placed.
  const seatWrite = await write(
    "seats",
    {
      induction: 21,
      program: "FCPS",
      quota: "Punjab",
      specialty: "Injected",
      hospital: "Injected Hospital",
      seats: 99,
    },
    candidateToken
  );
  // `write` returns the status code itself, not a response object.
  check("a candidate cannot insert a seat", seatWrite >= 400, true);

  // Checked by effect, not by status: PostgREST answers 204 with zero rows
  // affected when RLS hides the target, which reads as success.
  const injected = await get("seats?select=seats&specialty=eq.Injected", candidateToken);
  check("and no seat row appeared", injected.rows?.length ?? 0, 0);

  // `applicants` is the whole allocation pool — 3,474 preference lists. That is
  // the exact shape of the original's leak, which shipped every applicant's
  // record to every visitor. There is no product surface that needs the raw
  // rows, so neither client role may read it at all: no grant, no policy.
  // 403, not 401: the caller IS authenticated, they simply hold no privilege on
  // the table. Anonymous callers get 401 — asserted in the anon sweep above.
  const pool = await get("applicants?select=applicant_id&limit=5", candidateToken);
  check("a verified candidate cannot read the allocation pool", pool.status, 403);
  check("and gets no rows from it", pool.rows, null);

  const poolWrite = await write(
    "applicants",
    { induction: 21, applicant_id: 999999, preferences: [] },
    candidateToken
  );
  check("a candidate cannot write to the pool", poolWrite >= 400, true);

  const poolRpc = await fetch(`${BASE}/rest/v1/rpc/apply_applicant_pool`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${candidateToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_induction: 21, p_rows: [] }),
  });
  check("a candidate cannot call apply_applicant_pool", poolRpc.status >= 400, true);

  // The batch-apply function is service-role only.
  const rpc = await fetch(`${BASE}/rest/v1/rpc/apply_portal_inputs`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${candidateToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_induction: 21, p_rows: [] }),
  });
  check("a candidate cannot call apply_portal_inputs", rpc.status >= 400, true);
}

console.log("\npool_directory — the Candidate Pool roster");

// This table is the one place the project publishes a name for someone the
// gazette never named, so what it does NOT carry is as much the contract as
// what it does. The columns are asserted rather than trusted to the ingest
// script continuing to read the source record one field at a time.
{
  const roster = await get("pool_directory?select=*&limit=1", candidateToken);
  check("a verified candidate can read the roster", roster.rows?.length, 1);

  const CONTACT = ["cnic", "email_id", "contact_number", "father_name", "email", "phone"];
  const present = Object.keys(roster.rows?.[0] ?? {}).filter((k) =>
    CONTACT.includes(k)
  );
  check("the roster has no contact columns at all", present, []);

  // Parentage is embedded in the portal's own name field on all 3,474 records —
  // "Firstname Lastname D/O Father Name" — and the gazette prints none of it.
  // A single row slipping through means the strip stopped running.
  const names = await get(
    "pool_directory?select=name_full&limit=1000",
    candidateToken
  );
  const parentage = (names.rows ?? []).filter((r) =>
    /\s(D\/O|S\/O|W\/O|C\/O|Bint)\s/i.test(r.name_full ?? "")
  );
  check("no father's name is carried in the roster name", parentage.length, 0);

  // Three candidates typed their CNIC into the portal's name box. Publishing
  // that would put a national identity number under a column headed "Name".
  const cnics = (names.rows ?? []).filter((r) =>
    /\d{5}-\d{7}-\d/.test(r.name_full ?? "")
  );
  check("no CNIC is carried in the roster name", cnics.length, 0);

  // The roster is readable, but it is not writable, and the write must be
  // checked BY EFFECT: PostgREST answers 204 with zero rows affected when RLS
  // hides the target, which is a success status for a write that did nothing.
  const before = await get(
    "pool_directory?select=name_full&limit=1&order=applicant_id.asc",
    candidateToken
  );
  const attempt = await fetch(`${BASE}/rest/v1/pool_directory?limit=1`, {
    method: "PATCH",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${candidateToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ name_full: "OVERWRITTEN BY TEST" }),
  });
  const changed = await attempt.json().catch(() => []);
  check(
    "a candidate cannot write the roster",
    Array.isArray(changed) ? changed.length : 0,
    0
  );

  const after = await get(
    "pool_directory?select=name_full&limit=1&order=applicant_id.asc",
    candidateToken
  );
  check(
    "...and the row is unchanged",
    after.rows?.[0]?.name_full,
    before.rows?.[0]?.name_full
  );

  // The batch loader is service-role only, like the other two.
  const rosterRpc = await fetch(`${BASE}/rest/v1/rpc/apply_pool_directory`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${candidateToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_induction: 21, p_rows: [] }),
  });
  check("a candidate cannot call apply_pool_directory", rosterRpc.status >= 400, true);
}

console.log("\njoining status");

// ── joining_status ──────────────────────────────────────────────────────
//
// The joining export carries CNIC, email and phone on every row, plus the
// employment record collected at joining. None of it is ingested. Asserted
// rather than trusted to the script continuing to read one field at a time.
{
  const joining = await get("joining_status?select=*&limit=1", candidateToken);
  check("a verified candidate can read joining status", joining.rows?.length, 1);

  const WITHHELD = [
    "cnic",
    "email_id",
    "contact_number",
    "father_name",
    "emp_type",
    "emp_province",
    "bps",
    "dept",
    "desg",
  ];
  const presentCols = Object.keys(joining.rows?.[0] ?? {}).filter((k) =>
    WITHHELD.includes(k)
  );
  check("joining status carries no contact or employment columns", presentCols, []);

  const joiningNames = await get(
    "joining_status?select=name_full&limit=1000",
    candidateToken
  );
  const cnicNames = (joiningNames.rows ?? []).filter((r) =>
    /[0-9]{5}-[0-9]{7}-[0-9]/.test(r.name_full ?? "")
  );
  check("no CNIC is carried in the joining name", cnicNames.length, 0);

  // Checked by effect, not status: PostgREST answers 204 with zero rows
  // affected when RLS hides the target, which is a success status for a write
  // that did nothing.
  const joinWrite = await fetch(`${BASE}/rest/v1/joining_status?limit=1`, {
    method: "PATCH",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${candidateToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ status: "OVERWRITTEN BY TEST" }),
  });
  const joinChanged = await joinWrite.json().catch(() => []);
  check(
    "a candidate cannot write joining status",
    Array.isArray(joinChanged) ? joinChanged.length : 0,
    0
  );

  const stillClean = await get(
    "joining_status?select=status&status=eq.OVERWRITTEN%20BY%20TEST",
    candidateToken
  );
  check("...and no row took the value", stillClean.rows?.length ?? 0, 0);

  const joinRpc = await fetch(`${BASE}/rest/v1/rpc/apply_joining_status`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${candidateToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_induction: 21, p_rows: [] }),
  });
  check("a candidate cannot call apply_joining_status", joinRpc.status >= 400, true);
}

console.log("\ndata changes");

// ── data_changes ────────────────────────────────────────────────────────
//
// The source diff carries a CNIC correction for 397 of its 622 records and the
// old and new name strings for 400. Neither is ingested, and neither can be:
// there is no column able to hold a string at all. Asserted directly rather
// than trusted to the ingest script continuing to read one field at a time.
{
  const changes = await get(
    "data_changes?select=*&induction=eq.21&limit=1",
    candidateToken
  );
  check("a verified candidate can read data changes", changes.rows?.length, 1);

  const cols = Object.keys(changes.rows?.[0] ?? {});
  const stringy = cols.filter((c) =>
    ["cnic", "name_full", "old_text", "new_text", "preferences"].includes(c)
  );
  check("data changes carries no identity or preference column", stringy, []);

  // `field` names the thing that moved, and the two withheld ones must never
  // appear among them — a future ingest that stopped stripping would surface
  // here rather than on the page.
  const fields = await get(
    "data_changes?select=field&induction=eq.21&limit=1000",
    candidateToken
  );
  const names = new Set((fields.rows ?? []).map((r) => r.field));
  check("no cnic field is recorded", names.has("cnic"), false);
  check("no nameFull field is recorded", names.has("nameFull"), false);

  const run = await get("data_change_runs?select=*&induction=eq.21", candidateToken);
  check("a verified candidate can read the run summary", run.rows?.length, 1);

  // Checked by effect, not status: PostgREST answers 204 with zero rows
  // affected when RLS hides the target, which is a success status for a write
  // that did nothing.
  const write = await fetch(`${BASE}/rest/v1/data_changes?limit=1`, {
    method: "PATCH",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${candidateToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ kind: "OVERWRITTEN BY TEST" }),
  });
  const changed = await write.json().catch(() => []);
  check(
    "a candidate cannot write data changes",
    Array.isArray(changed) ? changed.length : 0,
    0
  );

  const stillClean = await get(
    "data_changes?select=kind&kind=eq.OVERWRITTEN%20BY%20TEST",
    candidateToken
  );
  check("...and no row took the value", stillClean.rows?.length ?? 0, 0);

  const rpc = await fetch(`${BASE}/rest/v1/rpc/apply_data_changes`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${candidateToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_induction: 21, p_rows: [] }),
  });
  check("a candidate cannot call apply_data_changes", rpc.status >= 400, true);

  const runRpc = await fetch(`${BASE}/rest/v1/rpc/apply_data_change_run`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${candidateToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_induction: 21, p_run: {} }),
  });
  check("a candidate cannot call apply_data_change_run", runRpc.status >= 400, true);
}

// The community tables are the only place where one user writes what another
// reads, so the assertions here are about people rather than about datasets:
// can somebody post as somebody else, flood a room, read a report filed about
// them, or moderate without being staff.
console.log("\ncommunity");
{
  const moderatorToken = await signIn("moderator@example.invalid");
  const meId = JSON.parse(
    Buffer.from(candidateToken.split(".")[1], "base64url").toString()
  ).sub;
  const modId = JSON.parse(
    Buffer.from(moderatorToken.split(".")[1], "base64url").toString()
  ).sub;

  const post = (path, token, body) =>
    fetch(`${BASE}/rest/v1/${path}`, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(body),
    });

  for (const table of [
    "community_threads",
    "community_replies",
    "community_posts",
    "chat_rooms",
    "chat_messages",
    "content_reports",
  ]) {
    const { status } = await get(`${table}?select=*&limit=1`);
    check(`anon cannot read ${table}`, status, 401);
  }

  // The whole identity model in one assertion. The original's new-thread form
  // has a free-text name field, which is why one of its live threads is signed
  // "Admin"; here both columns are overwritten by a trigger from the session.
  const spoof = await post("community_threads", candidateToken, {
    author_id: modId,
    author_name: "Admin",
    category: "general",
    title: "RLS probe — impersonation",
    body: "attempting to post as somebody else",
  });
  const spoofed = await spoof.json().catch(() => []);
  const spoofRow = Array.isArray(spoofed) ? spoofed[0] : null;
  check("a post cannot claim another author's id", spoofRow?.author_id, meId);
  check(
    "a post cannot claim another author's name",
    spoofRow?.author_name !== "Admin",
    true
  );

  const threadId = spoofRow?.id;

  // Reports name their reporter, and the policy compares it to auth.uid().
  const forged = await post("content_reports", candidateToken, {
    target_type: "thread",
    target_id: threadId,
    reporter_id: modId,
    reason: "spam",
  });
  check("a report cannot be filed under someone else's id", forged.status >= 400, true);

  const real = await post("content_reports", moderatorToken, {
    target_type: "thread",
    target_id: threadId,
    reporter_id: modId,
    reason: "spam",
  });
  check("a verified user can report", real.status < 400, true);

  // The reported author must not be able to see who objected, or that anybody
  // did. A report visible to its subject is an invitation to retaliate.
  const seen = await get(
    `content_reports?select=id&target_id=eq.${threadId}`,
    candidateToken
  );
  check("the reported author sees no report about them", seen.rows?.length ?? 0, 0);

  // Checked by effect, not status: PostgREST answers 204 with zero rows when a
  // policy hides the target.
  const modAttempt = await fetch(
    `${BASE}/rest/v1/content_reports?target_id=eq.${threadId}`,
    {
      method: "PATCH",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${candidateToken}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ resolved_at: new Date().toISOString(), action: "kept" }),
    }
  );
  const resolved = await modAttempt.json().catch(() => []);
  check(
    "a candidate cannot resolve a report",
    Array.isArray(resolved) ? resolved.length : 0,
    0
  );

  // Announcements is staff-write only. A room anyone can write to is a
  // discussion; one labelled "Announcements" that anyone can write to is a way
  // to publish a false announcement mid-cycle.
  const announce = await post("chat_messages", candidateToken, {
    room_id: "announcements",
    body: "RLS probe — candidate announcement",
  });
  check("a candidate cannot post in Announcements", announce.status >= 400, true);

  const general = await post("chat_messages", candidateToken, {
    room_id: "general",
    body: "RLS probe — general",
  });
  check("a candidate can post in General", general.status < 400, true);

  // Rate limits live in the insert policies, so they hold for anything holding
  // a token — not only for callers who use our server actions.
  let accepted = 0;
  for (let i = 0; i < 8; i += 1) {
    const attempt = await post("community_threads", candidateToken, {
      category: "general",
      title: `RLS probe — rate ${i}`,
      body: "body",
    });
    if (attempt.status >= 400) break;
    accepted += 1;
  }
  check("thread rate limit stops the sixth in an hour", accepted <= 5, true);

  // Cleanup runs with the service role: these rows were created by the suite.
  const admin = (path) =>
    fetch(`${BASE}/rest/v1/${path}`, {
      method: "DELETE",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });
  await admin("content_reports?id=gt.0");
  await admin("community_replies?id=gt.0");
  await admin("community_threads?id=gt.0");
  await admin("chat_messages?id=gt.0");
}

console.log("\nstaff");
const adminToken = adminTokenForPeek;
const staffView = await get("candidates?select=applicant_id&limit=500", adminToken);
check("staff can read all candidate records", staffView.rows?.length > 1, true);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
