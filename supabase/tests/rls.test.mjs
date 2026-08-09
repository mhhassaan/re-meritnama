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
]) {
  const { status } = await get(`${table}?select=*&limit=1`);
  check(`anon cannot read ${table}`, status, 401);
}

console.log("\nsigned-in candidate (linked to 900001)");
const candidateToken = await signIn("candidate00001@example.invalid");

const tier1 = await get("merit_entries?select=id&limit=5", candidateToken);
check("can read tier 1 merit entries", tier1.rows?.length > 0, true);

const own = await get(
  "candidates?applicant_id=eq.900001&select=applicant_id,cnic",
  candidateToken
);
check("can read own candidate record", own.rows?.length, 1);

const other = await get(
  "candidates?applicant_id=eq.900002&select=applicant_id,cnic",
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
  (await write("candidates?applicant_id=eq.900001", { cnic: "tampered" }, candidateToken, "PATCH")) >= 400,
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

console.log("\nstaff");
const adminToken = adminTokenForPeek;
const staffView = await get("candidates?select=applicant_id&limit=500", adminToken);
check("staff can read all candidate records", staffView.rows?.length > 1, true);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
