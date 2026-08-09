/**
 * Generates a set-password link WITHOUT sending an email.
 *
 * Diagnostic tool. Email delivery adds two failure modes that are hard to tell
 * apart from a broken auth flow: an inbox containing several links where only
 * the newest is valid, and mail providers that open links automatically to scan
 * them, consuming single-use tokens before the recipient clicks.
 *
 * `generateLink` returns the same token the email would carry, so the flow can
 * be exercised end to end with neither of those variables in play.
 *
 * Usage:  node supabase/fixtures/make-link.mjs <email> [recovery|invite]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const here = dirname(fileURLToPath(import.meta.url));

for (const line of readFileSync(join(here, "..", "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const email = process.argv[2];
const type = process.argv[3] ?? "recovery";

if (!email) {
  console.error("Usage: node supabase/fixtures/make-link.mjs <email> [recovery|invite]");
  process.exit(1);
}

const db = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await db.auth.admin.generateLink({
  type,
  email,
  options: { redirectTo: `${site}/auth/callback?next=/auth/update-password` },
});

if (error) {
  console.error("generateLink failed:", error.message);
  process.exit(1);
}

const hashed = data.properties?.hashed_token;
if (!hashed) {
  console.error("No hashed_token returned:", JSON.stringify(data.properties, null, 2));
  process.exit(1);
}

// Build the same URL the corrected email template produces, so this exercises
// the real server-side path rather than a parallel one.
const link =
  `${site}/auth/callback` +
  `?token_hash=${encodeURIComponent(hashed)}` +
  `&type=${encodeURIComponent(type)}` +
  `&next=${encodeURIComponent("/auth/update-password")}`;

console.log(`\ntype:  ${type}`);
console.log(`email: ${email}`);
console.log(`\nOpen this once, in a normal browser window:\n\n${link}\n`);
console.log("Single use. If it fails, run this script again for a fresh one.");
