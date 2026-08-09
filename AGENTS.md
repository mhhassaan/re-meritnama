<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# MeritNama

Residency induction analytics for MBBS/BDS graduates applying through Punjab's
PHF/PRP system. Merit calculation, cutoff history across 13+ induction cycles, a
cascade seat-allocation simulator, and community features.

This repository is a **redesign**: a Next.js 16 app being built alongside the
original static HTML/JS site, whose files still sit in the repo root
(`app.html`, `admin.html`, `js/`, `auth.js`, …) and are gitignored. Read them as
evidence of intended behaviour; do not extend them.

## Why the security posture is what it is

The original site published candidate PII. Three files were downloadable by
anyone, unauthenticated:

- `induction21_candidates.json` (78 MB) — name, **CNIC**, PMDC number, email,
  phone for ~3,475 real doctors
- `candidate_auth_index.json` — every registered email plus an unsalted SHA-256
  of the applicant id, which is a 3–5 digit number and so reversible in seconds
- `grievance_verification.json` — names, father's names, contact details,
  complaint text

Its Firestore rules were `allow read, write: if true` on ~30 collections,
including the credential table (world-writable, so anyone could self-grant
admin) and the `mail` collection (an open relay under the project's verified
sender).

**Every rule below exists because of a specific failure there. They are not
stylistic preferences.**

## Hard rules

1. **Never put per-candidate data in `public/`.** Anything under `public/` is
   served verbatim with no authentication. Aggregates (cutoffs, trends, seats,
   policy, `flat_lookup.json`) are fine; anything with a name, CNIC, PMDC
   number, email or phone is not.
2. **The `service_role` key bypasses every RLS policy.** Server-only, never
   `NEXT_PUBLIC_`, never imported into a client component. `src/lib/supabase/admin.ts`
   carries `import "server-only"` so a mistake is a build error, not a leak.
   Reaching for it to make a permission error go away removes access control
   rather than fixing the cause.
3. **RLS is the last line of defence and must never be the only one.** Route
   gates and role checks protect the UI; the database protects the data. Write
   both.
4. **Rules authorise from `request.auth` / `auth.uid()`, never from a field in
   the row being written.** Checking a `role` column lets a caller grant
   themselves a role.
5. **Identity is proven by delivery, not by the form.** Email and applicant id
   are both published and both appear in the historic leak, so neither proves
   anything. What proves a claim is that a credential reaches the address
   already on the candidate record. Any code path that lets a caller choose the
   destination address breaks the entire model.
6. **Never put a credential in an email body.** The original emailed PINs in
   plain text. Send a single-use, expiring link.
7. **Synthetic fixtures only in development.** `.invalid` emails, `00000-`
   CNICs, `FAKE-` PMDC numbers, applicant ids from 900001. Never copy real
   records into a development project.

## Architecture

**Supabase** (Postgres + Auth + Storage + RLS) on project `xyzsmnckvgysrlpwjibp`,
development only. Production will be a separate project under the owner's
account. Firebase was used earlier and has been removed.

### Two-tier candidate model

The split is produced at **write** time by the ingest pipeline, not filtered at
read time. The original's failure was shipping one file containing everything
and relying on the UI not to render the private parts.

| Table | Contents | Readable by |
| :-- | :-- | :-- |
| `merit_entries` | Tier 1 — what the gazette publishes: name, applicant id, **PMDC**, marks, programme, specialty, hospital, quota, preference, placement | any verified signed-in user |
| `candidates` | Tier 2 — CNIC, email, phone, father's name, full preference list | the linked candidate, and staff |

PMDC is deliberately in Tier 1: the original exposed it and made it searchable
in the merit list, and that behaviour is preserved. Tier 1 requires sign-in, also
as the original did.

`candidate_links` connects an auth user to a candidate row; it is written only
by the server after verification. `user_roles` has **no** client write policy.

### Applicant IDs are reissued every induction

Verified against the archives: inductions 20 and 21 share 144 applicant ids and
**none of them is the same person**. An applicant id is meaningful only as
`(induction, applicant_id)`.

- `candidates` has a surrogate `id` primary key plus `unique (induction, applicant_id)`
- `candidate_links` keys on `(user_id, candidate_id)` so one account can hold a
  link per cycle
- `access_requests` keys on `(email, induction)`
- Every lookup taking an applicant id from a user must pair it with
  `CURRENT_INDUCTION` (`src/lib/induction.ts`)

Not yet built: when Induction 22 opens, returning candidates get a new applicant
id and must re-verify to link the new cycle.

### Design tokens

Two families, in `src/app/globals.css`:

- `brand-*` — theme-invariant. Marketing pages use these and stay light on purpose.
- semantic (`background`, `surface`, `foreground`, `accent`, `status-*`) — flip
  with the theme. App and admin surfaces use these.

Never hardcode a hex value. Colours that must reach canvas or WebGL live in
`src/lib/design/brand.ts`. Specialty colour is carried by **discipline family**,
not per specialty (`src/lib/design/specialty.ts`) — 44 specialties cannot have
44 accessible hues. All numerics use `font-mono`; primary buttons are
`rounded-sm`. See `DESIGN_GUIDELINES.md`.

### Charts — `@bklit`

Charts come from the `@bklit` shadcn registry (`npx shadcn@latest add @bklit/<slug>`),
installed as source into `src/components/charts/`. The `bklit-ui` skill carries
the composition and theming rules. **Do not hand-roll a new chart** — the one
exception already in the tree is `src/components/merit/sparkline.tsx`, which is
an inline 80×26 glyph rendered once per row, where a full chart component would
be the wrong tool.

Chart tokens are **derived from the semantic tokens** (`--chart-grid: var(--border)`
and so on), so they flip with the theme and no chart colour is restated in a
dark block. Only `--chart-scale-01…05` is per-theme, because a sequential scale
must run light-to-dark on a light ground and the reverse on a dark one. Series
colours reuse the specialty family hues. Reach a family colour from JS with
`specialtyColorVar()`, never a raw hex.

Four traps, all already hit:

- The shadcn CLI writes its `@theme` bindings as `var(----chart-1)` — **four
  dashes**, which resolves to nothing. Every chart utility silently falls back
  to transparent. Check the bindings after any `shadcn add`.
- It also injects a `.dark { }` block and `@custom-variant dark (&:is(.dark *))`.
  This project has no `.dark` class — theme is `data-theme` plus
  `prefers-color-scheme` — so that block is dead code. Remove it and put any
  genuinely per-theme value in the two real dark blocks.
- `@bklit`'s `Line` coerces a non-numeric y value to **0**. Passing a gap
  through as null draws a plunge to zero, inventing a catastrophic result. Drop
  gaps from the series instead, and show markers so every dot is a real
  observation.
- `LineChart` is a **time-series** chart: it coerces x with `new Date()` and has
  no ordinal mode, and its axis labels come from an internal formatter with no
  override. Induction cycles are ordinal, so `XAxis` is not used — the tick row
  under `MeritTrendChart` is ours.

## Commands

```
npm run dev            # dev server on :3000
npm run build          # must pass before calling anything done
npm run fixtures       # regenerate synthetic candidates
SUPABASE_SEED_ALLOW_PROJECT=<ref> npm run seed
npm run test:rls       # 20 access-control assertions over the real REST API
node supabase/fixtures/make-link.mjs <email> [recovery|invite]
```

Dev accounts (password `devpassword123!`): `candidate00001@example.invalid`,
`admin@example.invalid` (super_admin), `moderator@example.invalid`.

## Testing discipline

- **Access-control tests run over HTTP against the real REST API**, not in SQL.
  The public endpoint is the surface that actually leaked.
- **Check writes by effect, not by status code.** PostgREST returns **204 with
  zero rows affected** when RLS hides the target — a success status for a write
  that did nothing. Asserting on status alone reports a real breach as a pass.
  This mistake has already been made twice here.
- After any schema change: `get_advisors` (security **and** performance),
  regenerate `src/lib/supabase/types.ts`, re-run `npm run test:rls`.
- A test suite that only exercises the happy path proves nothing. The first
  33-assertion suite passed while a bug silently denied every non-staff user.

## Traps already hit — do not rediscover

**Next.js 16**
- Middleware is renamed **Proxy**: `src/proxy.ts`, named export `proxy`. Docs are
  in `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`, and
  state it is for optimistic checks only — never the authorization layer.
- `useSearchParams()` opts a route out of static prerendering unless wrapped in
  `<Suspense>`.
- `notFound()` in a layout sets the 404 status but **does not stop child pages
  rendering**; their output still appears in the response body. Repeat the check
  in the page.
- Never `toLocaleDateString()` without a fixed locale and time zone — server and
  client differ and hydration fails. Use `src/lib/format/date.ts`.

**Supabase / Postgres**
- Default privileges grant **ALL** on every new public table to `anon` and
  `authenticated`. Explicit `GRANT`s on top are no-ops. Revoke first, then grant
  narrowly, or RLS is the only control.
- RLS policies evaluate **as the calling role**, so helper functions must be
  executable by `authenticated`. Revoking `EXECUTE` does not harden them, it
  makes every policy error out.
- Policy helpers are `SECURITY DEFINER` in the non-exposed `private` schema with
  `search_path = ''`. That, not the grant, is what keeps them off the API.
- Wrap `auth.uid()` and helpers in a scalar subquery — `(select auth.uid())` —
  or they are evaluated once per row.
- `to authenticated using (true)` is authentication without authorization. If
  anonymous sign-ins are ever enabled, anonymous users hold the `authenticated`
  role. Gate on `private.is_verified()`.
- Email templates must be changed from `{{ .ConfirmationURL }}` to
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=<type>`. The
  default is the implicit flow, which returns the session in the URL fragment —
  which a server route can never see.
- Emailed links are single-use. Do not `fetch()` one to inspect it; that spends
  it. Mail scanners do the same to real users, which is why the resend action
  exists.

## Out of scope

- **The PRP portal ingestion pipeline** (authenticated fetch and gazette
  reconciliation). This product consumes its curated JSON output only.
- **The live site, its repository, and its Firebase project.** Owned by the
  original owner. Do not attempt to deploy or modify them.

## Standing context

The work is being done by a contractor who does not own the live site, its
domain, or its Firebase project. Anything requiring DNS, production billing, or
the real user data is blocked on the owner and should be flagged rather than
worked around.
