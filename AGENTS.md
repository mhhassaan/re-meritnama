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
7. **Fixtures are synthetic; the ingested consent rounds are not.** Synthetic
   fixtures use `.invalid` emails, `00000-` CNICs, `FAKE-` PMDC numbers and
   applicant ids from 900001, and remain the default for anything generated.

   **Exception, decided by the owner:** the Induction 21 consent rounds hold
   real records — 1,453 doctors, with names and mobile numbers — and have been
   loaded into the development project deliberately. Real applicant ids run
   2255–39524, so `applicant_id >= 900001` still separates fixture from real.
   The consequence is that this dev project now holds real personal data and
   must be treated accordingly: no sharing the `service_role` key, no dumps
   into the repo, and the project is deleted rather than left idle when the
   production project exists.

8. **Ingest inputs live in `ingest/`, never `public/`.** `public/` is served
   verbatim with no authentication — that is exactly how the original leaked.
   `/ingest/` is gitignored. This was not hypothetical: the 13 consent-round
   files sat in `public/data/` and were being served by this app at
   `/data/induction21_consent_round1.json` (HTTP 200, 769 KB, 1,053 names and
   mobile numbers) until they were moved.

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

### The portal's allocation inputs

`seats` is capacity per (induction, programme, quota, specialty, hospital). It
carries no personal data, so any **verified** signed-in user reads all of it —
the same test the merit aggregates pass. Nobody writes it; the ingest pipeline
uses the service role.

The cascade has to read every candidate's preferences, marks and verification
status, which no signed-in user may do for anyone but themselves. The answer is
**not** a service-role client pointed at `candidates` — that table holds CNIC,
email, phone and father's name, and a bug in the engine would then be a contact
leak rather than a wrong number. `cascade_inputs` is a `security_invoker` view
carrying only the six columns the algorithm uses. Nothing sensitive is reachable
through it even with the service role, because nothing sensitive is in it.
Display names come from `merit_entries`, which is Tier 1 and already published.
**Never widen that column list** — it is the whole justification for the design,
and `test:rls` asserts it.

Two columns are easy to confuse, which is why one was renamed:

| Column | Contents |
| :-- | :-- |
| `candidates.preferences` | the ordered list of every seat the candidate applied for — what the cascade walks |
| `candidates.consent_rounds` | one entry per round they consented in: the seat offered and whether they took it |

The second used to be called `preferences`, and the app was reporting a
candidate with eight consent rounds as having submitted eight preferences.

### Cycles are keyed by induction and **displayed as years**

The keys in `flat_lookup.json` are **induction numbers** ("8" … "20") — there is
no year in that file. The year comes from `policy_by_induction.json`, and
`loadCycles()` in `src/lib/merit/data.ts` joins them.

**In the merit table, only the year is ever printed** — `cycle.label`. No
"Ind 20", no "Induction 20". This matches the live site and is a standing
product decision.

The consequence, accepted deliberately: several years ran two or three
inductions (2021 ran 9 and 10; 2023 ran 13 and 14; 2025 ran 17, 18 and 19), so a
year can appear as two or three identically-labelled columns. Columns stay in
cycle order, so the left one is the earlier, and the full policy label — which
does name the induction — is on the `title`. The live site behaves the same way.

**Where the cycles are not in a row, the induction is written out** —
`cycle.labelWithInduction`, e.g. `2026 (Ind 21)`. The original does this on the
app landing and in the merit-list picker, and the owner asked for it to be
carried over. It applies to the Start Here cycle cards, the merit-list cycle
selector, and the merit-list summary box. The distinction is positional, not
arbitrary: an ordered row of columns tells two same-year cycles apart by
position, a dropdown offering "2026" twice does not.

Both labels are built in `loadCycles` / `loadCycleSummaries`
(`src/lib/merit/data.ts`) and in `loadAvailableCycles`
(`src/lib/merit-lists/data.ts`). Never assemble either string in a component.

The local `app.js` in the repo root is **older than what is deployed**: it reads
the cycle keys as years directly, so it would render "8" under a "Year" header.
The deployed build maps them properly. Check the live page, not that file.

**`simulation.html` is stale in the same way, and worse.** It opens on a "Guide"
tab and its nav lists "Where Merit Falls" and "Seat Allocation". The deployed
portal opens on **Overview** and its nav is Overview / Candidate Pool / Merit
List / Joining Status / Config, then Schedule / Hospitals / Profiles / Chat,
then Competition / Training Seats / Accreditation / Data Changes. It is
organised around the published merit list with a consent overlay, not around a
blank-slate allocation. Sign in and look before porting any portal tab.

Two source fields are averages over raw marks from cycles whose totals were 95,
60, 35 and 30, and are therefore arithmetic over incommensurable units:
`avg_closing_merit` and `stddev`. **Neither is ever displayed.** Both are
recomputed on the normalised scale where the number means what its label says.

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

### What is built, and the order it is being built in

The app shell is `src/app/(app)/layout.tsx` — sticky `h-16` header, persistent
sidebar from `lg` up, slide-in drawer below. Nav lives in
`src/components/app/app-nav.tsx`. **Unbuilt destinations are listed and marked
"Soon", never hidden** — someone arriving from the original expects Consent
What-If and the Candidate Pool, and omitting them reads as lost features.

**There are two navigations, because the original is two applications.**
`app.html` analyses closed cycles; `simulation.html` works the cycle that is
open now, and it replaces the nav entirely rather than adding tabs to it — its
own groups, and a "← Historical Data" link back out.

That separation is kept. `NAV_GROUPS` (Analyze / Tools / Resources) is the
analysis app, and lists the portal as a single door. `PORTAL_NAV_GROUPS` (Start
/ Plan / More) takes over for everything under `/app/portal`, with the back
link at the top. `NavList` switches on the path; there is no second layout.
Flattening the portal's tabs into the main sidebar loses the distinction
between "what closed" and "what is open", which is the whole point of the
split.

**The portal's Start group follows the deployed original exactly** — Overview,
Candidate Pool, Merit List, Joining Status, Config — and **our own pages come
after it**. Where Merit Falls and Seat Allocation are not tabs on the live
portal at all; its Merit List does both jobs behind one screen. They were built
here, they work and they are graded by `test:placement`, so they stay, but
placed after Config rather than beside the Merit List. An earlier version
interleaved them and thereby presented pages of ours as part of the portal's own
sequence. Anything we add to a ported nav goes after everything the original
has, in a position that reads as an addition.

| # | Page | Route | State |
| :-- | :-- | :-- | :-- |
| 1 | Merit Table | `/app/merit` | built |
| 2 | Calculator | `/app/calculator` | built |
| 3 | My Prediction | `/app/prediction` | built |
| 4 | Start Here | `/app/start` | built |
| 5 | Previous Merit Lists | `/app/merit-lists` | built |
| 6 | Compare Specialties | `/app/compare` | built |
| 7 | Candidate Portal home | `/app` | built |
| 8 | Where Merit Falls | `/app/portal/slots` | built |
| 9 | Seat Allocation | `/app/portal/allocation` | built |
| 10 | Portal Overview | `/app/portal` | built |
| 11 | Portal Merit List | `/app/portal/merit-list` | built |
| 12 | Training Seats | `/app/portal/seats` | built |
| 13 | Schedule | `/app/portal/schedule` | built |
| 14 | Candidate Pool, with the roster | `/app/portal/pool` | built |
| 15 | Joining Status | `/app/portal/joining` | built |
| 16 | Config | `/app/portal/config` | built |
| 17 | Hospitals, with per-hospital profiles | `/app/portal/hospitals` | built |
| 18 | Competition & Demand Index | `/app/portal/competition` | built |
| 19 | Consent What-If, Profiles, Chat, the rest | — | next |

Every app surface is now on the redesign. `/app` was the last placeholder: it
hardcoded the 1,470 row count, printed `Induction 21` with no year, used
`rounded-md` borders instead of `Bezel`, and told the reader that prediction,
the calculator and the simulator were "not built yet" — by then three of those
were. Anything asserted in copy that the data can supply is now read from the
data, so it cannot rot the same way.

### How a page gets ported

This has worked every time and is worth repeating rather than improvising:

1. **Read the live page, not the local `js/`.** Sign in at
   `itskaero.github.io/meritnama/app.html` with the owner-supplied credentials
   and click the tab. The repo's `js/` is older than what is deployed — that is
   how the "years are actually inductions" mistake happened.
2. **Pull the engine out of `js/` into a pure module** under `src/lib/`, then
   **pin it with tests against numbers read off the live site.** Every port so
   far has caught a real bug this way.
3. **Match the framing exactly; redesign only the presentation.** Standing
   instruction from the owner. Wording, thresholds, column order and copy are
   the original's.

### Two merit-list pages, and why both

`/app/merit-lists` and `/app/portal/merit-list` read the same rows and are not
duplicates. The unit differs, and so does the question.

| Page | Unit | Answers |
| :-- | :-- | :-- |
| `/app/merit-lists` | a person | "where does this candidate appear?" |
| `/app/portal/merit-list` | a seat | "who is in this seat, and who is behind them?" |

The portal one groups by `(program, specialty, hospital, quota)`, shows each
occupant's consent state, and computes a **next-in-line queue** per seat from
the full applicant pool — ranked by the mark that applies to that seat, and
tagged with whether each person would actually move: fresh placement, upgrade
chance, at higher preference, or locked to another programme.

Names come from `merit_entries` across **all rounds**, not the round on screen.
The queue is drawn from the whole pool, so it routinely contains people who
appear in round 3 and not round 8 — reading names from the current round alone
showed them as unnamed when the gazette had already published them.

The original's Tidbits sidebar prints each name with their father's name. That
is on `candidates`, Tier 2, published nowhere, and is **not** shown here. The
applicant id disambiguates.

### Registries and icons

Four shadcn registries are configured in `components.json`:

| Namespace | For | Note |
| :-- | :-- | :-- |
| `@bklit` | charts | see the charts section |
| `@hugeicons-animated` | motion icons | registry URL undocumented; `hugeicons-animated.com/r/{name}.json` |
| `@pdfcn` | PDF documents | registry is `www.pdfcn.dev`, not the `.vercel.app` homepage |
| `@shadcn` | base | only `utils` is used |

**Icon policy:** Koboyo (`src/components/icons/koboyo.tsx`, inlined SVG source)
for static icons; `@hugeicons-animated` where motion earns its place. Koboyo
icons are hand-drawn with per-icon viewBoxes — size by setting ONE dimension
(`h-5 w-auto`) and never force one into a square box.

**Anything clickable carries an animated icon.** Standing instruction from the
owner. Buttons, submits, load-more, toolbar actions and nav rows use
`@hugeicons-animated`; Koboyo stays for decoration and labelling — a specialty
marker beside a heading, an empty-state illustration, an inline status glyph.
Motion is what separates a control from ornament, and a screen whose icons never
react reads as a picture of an interface rather than one.

`src/components/app/action-icon.ts` is the whole wiring:

```tsx
const { ref, handlers } = useActionIcon();
<button {...handlers}><FilterIcon ref={ref} size={ICON_SIZE_SM} /></button>
```

It exists because these icons animate on hover of **their own element** — 16
pixels inside a control that is often hundreds wide — so left alone they play
only when the pointer crosses the artwork, which reads as broken rather than
subtle. Attaching a `ref` switches the component to parent control, and the
hook also wires `onFocus`/`onBlur`, without which the cue is pointer-only:
feedback for some people, decoration for everyone else.

**The navigation is `@hugeicons-animated` throughout**, both the analysis rail
and the portal's, and that is as much an alignment decision as a motion one.
Koboyo's per-icon aspect ratios are right for its hand-drawn look and wrong for
a vertical list: a wide icon pushes its label further right than a narrow one,
so the left edge of the text wanders down the column. Every animated icon is
drawn on a 24×24 viewBox and rendered square, so a single `ICON_SIZE` aligns
every label — measured, all 15 portal labels and all 12 analysis labels start at
the same x.

Three things about wiring one of these into a row, all of which bit:

- They render a **`<div>`**. The "Soon" row was a `<span>`, which made it invalid
  HTML the moment the icon stopped being an `<svg>`; it is a div now.
- They animate on hover of **their own element** — 18 pixels inside a full-width
  link. Passing a `ref` switches the component to parent control
  (`useIconAnimation` sets `isControlledRef` when the handle attaches), so the
  row owns `onMouseEnter`/`onMouseLeave` and hovering anywhere along it plays.
- `onFocus`/`onBlur` are wired alongside, or the animation is a pointer-only
  cue: feedback for some people and decoration for everyone else.

`prefers-reduced-motion` is handled inside `src/lib/use-icon-animation.ts`, so
no call site guards it. The registry's index — useful, and undocumented — is
`hugeicons-animated.com/r/registry.json`; it listed 165 icons.

**Every one of these registries has written a file to one path and imported it
from another.** `@bklit` ships `../components/shimmering-text`; `@pdfcn` writes
its types to `src/types/` and imports them from `@/components/`. Run
`npx tsc --noEmit` immediately after any `shadcn add` and expect to patch
imports. `shadcn add --overwrite` also re-injects the broken `var(----chart-1)`
bindings and the dead `.dark` block into `globals.css` — re-check both.

### PDF export

`src/components/predict/prediction-report.tsx` builds the document with
`@pdfcn` on its Takumi base; `export-report-button.tsx` renders it.

Generated **in the browser**, deliberately: a merit score is the entire content
of that report, and rendering it server-side would post a candidate's score to
us for no reason. The ~2 MB WASM engine is imported on click, not in the bundle.

**Never `import("takumi-pdf")` bare.** Turbopack resolves it to the Vite bundle,
which imports a `.wasm_.loader.mjs` shim it cannot follow, and the build fails
outright. Use:

```js
const [{ render, default: init }, { default: wasmUrl }] = await Promise.all([
  import("takumi-pdf/no-init"),
  import("takumi-pdf/wasm-url"),
]);
await init({ module_or_path: wasmUrl });
```

### The Induction Portal

The original is `simulation.html` plus 20 `js/sim-*.js` files, ~19,600 lines and
**13 tabs** in four groups: Guide, Candidate Pool, Where Merit Falls, Seat
Allocation, Consent What-If, Joining Status and Config; then Schedule,
Hospitals, Profiles and Chat; then Competition and Training Seats.

**There are two different allocation algorithms and they are easy to confuse.**

`sim-placement.js` runs deferred acceptance **from a blank slate**: nobody holds
a seat, everyone walks their preference list, highest mark wins each contest.
It splits every candidate into a civilian and an armed track and runs them as
separate competitors. That is the Seat Allocation tab.

`sim-cascade.js`, ported to `src/lib/portal/cascade.ts`, does **not** start
blank. It loads the published merit list as initial occupancy, vacates the seats
of everyone who rejected, is awaited, or failed verification, and cascades the
rest upward into the holes. That is the question candidates actually ask between
rounds. Its five constraints are documented in the module with what each one
prevents — removing any of them still produces plausible-looking output.

### The allocation pool, and why it has its own table

`candidates` holds only the 1,453 people who reached a merit list. The cycle had
**3,474** applicants, and the other 2,021 are exactly the competition — an
allocation without them understates how contested every seat is, so every
predicted placement comes out optimistic. Wrong in the direction people want to
believe is the worst direction to be wrong in.

`public.applicants` is the full pool. It carries preferences, marks,
certificates and verification status, and deliberately **no name and no contact
details**. `merit_entries` already publishes the name of everyone who placed;
nobody has ever published the names of those who did not, and this project is
not going to be first. Anyone unnamed renders as an applicant id.

**Neither client role may read it — no grant, no policy.** 3,474 preference
lists is the exact shape of the original's leak. The engine reads it server-side
with the service role, and what makes that safe is not care in the calling code
but that the table *cannot* identify anyone.

### The Candidate Pool has a roster, and what that cost

`/app/portal/pool`. The page is the original's Candidate Pool tab: aggregates
over the whole pool, then a searchable table of all 3,474 applicants, and a row
click opens that person's marks breakdown, preference list and certificates.

**This widened the tier split, and the owner decided it.** The design's default
is that a full preference list is Tier 2 — the linked candidate and staff only —
and that the 2,021 applicants the gazette never published stay unnamed. The
roster overrides both, for verified users. Do not re-litigate it and do not
quietly narrow it back; the reasoning is in
`supabase/migrations/20260821175535_pool_directory_roster.sql`.

The distinction that makes it defensible: **the original's roster was not the
leak.** The leak was three JSON files served at public URLs with no
authentication at all. The Candidate Pool tab itself sat behind an invite-only
email-and-PIN scheme — one the historic leak had already broken, since the auth
index was public and the PIN was a reversible hash of a 3–5 digit id. Our gate
is `private.is_verified()`, which is strictly stronger.

Three limits came with the decision and are part of it:

- **Contact details stay Tier 2.** `pool_directory` has no CNIC, email, phone or
  father's name — the original's own modal shows none of them either.
- **No bulk export.** The original offers "download the pool as PDF". Not
  ported. Search, filter, sort and paging all run in the database, so no single
  request returns the whole pool.
- **The engine's table is untouched.** `applicants` still carries no identity,
  because the allocation engine reads it with the service role and what makes
  that safe is that a bug there cannot leak a name. The roster is a **separate**
  table with a policy. Two tables, two different guarantees — never add a name
  column to `applicants`.

`supabase/ingest/pool-directory.mjs` loads it, and reads the source record one
field at a time rather than spreading it, so `cnic`, `emailId` and
`contactNumber` cannot arrive by accident. `test:rls` asserts the absence
directly rather than trusting that.

**Two things in the source had to be cleaned, and both were real.** The portal
writes parentage into the name field — `"Firstname Lastname D/O Father Name"` on
all 3,474 records, 2,119 `D/O`, 1,351 `S/O`, 4 `Bint` — while the gazette prints
none of it (0 of 1,219 names in round 8). Ingesting `nameFull` verbatim would
have published 3,474 fathers' names. And three candidates typed their **CNIC**
into the name box, so their entire `nameFull` is a national identity number;
those names are withheld and render as "Applicant 38297". Both are asserted in
`test:rls`, because a future ingest that stops stripping would otherwise look
fine.

**The stats bar counts `applied_in`, not the preference list.** They genuinely
disagree, and the original counts the former. With that field the counts match
the live site exactly — FCPS 2,284, MS 762, MD 1,316, multi-programme 949. The
one figure that still differs is "applied to no programme": the live site prints
100 because its counter checks FCPS, MS and MD only, so the 13 people who
applied to MDS alone are counted as having applied to nothing. Ours prints 87 and
the page says why. That is a defect being declined, not framing being changed.

The aggregate half of the page is `src/lib/portal/pool-stats.ts` — pure,
dependency-free, graded by `test:pool`, and still incapable of returning an
individual. Numbers it reports for Induction 21: 3,474 applicants, 3,289
cleared, 185 rejected, 180,784 preferences, longest list 358, mean 52. Marks run
8.97 to 22.17, median 17.32 — **base aggregates**, below what a merit list
prints, because a merit list shows the effective mark for the seat it lists.

### Joining Status, and a date format that breaks `new Date()`

`/app/portal/joining`. The last question of a cycle: round 8 placed people into
742 seats, the final export covers 1,082 candidates across 679 of them, and
1,077 have joined. A seat on a merit list is not a doctor in a hospital.

**The export writes `DD/MM/YYYY` and JavaScript reads it as month-first.**
`new Date("04/06/2026")` returns 6 April for a 4 June joining, and where the day
is above 12 there is no such month so it returns `Invalid Date` outright. **256
of the 1,082 rows have a day above 12 and none has a second component above 12**,
which settles the order beyond argument. The live portal shows "Joined · Apr 6"
for those it can parse and a literal "Invalid Date" for the rest. Ours reads the
components textually and rebuilds them — the same fix the schedule needed, for
the same reason.

**One field carries two different facts.** For a candidate who joined,
`joiningDate` is the day they did; for one still pending it is the day by which
they had to. The card labels it accordingly, because printing "Joined · 3 Jun"
against somebody who has not joined is simply false.

`joining_status` carries what the original's card shows and nothing else. Beyond
the usual CNIC, email and phone, the export also holds the **employment record**
collected at joining — `empType`, `empProvince`, `bps`, `dept`, `desg`. That is
not in the gazette, not in the original's card, and was not in the historic leak
either, so ingesting it would put this project ahead of every other source. It
is not ingested, and `test:rls` asserts the columns do not exist.

Two figures differ from the live site and both are deliberate:

- **Seats with nobody: 66, against its 67.** Computed as final-round seats with
  no row in the export — 73 people placed into slots that nobody appears
  against, which reads as the seat being vacated outright rather than allocated
  to someone who failed to report.
- **"Likely wasted" is not shown.** The live site splits "not joined" into
  *within window* and *likely wasted*, and nothing in the export distinguishes
  them — its own counter puts all five pending candidates in the first bucket
  while their deadlines have passed. Rather than invent a threshold, each
  candidate's deadline is printed on their row.

### Config, and the one setting that is real

`/app/portal/config`. The original keeps three settings and promises "changes
apply immediately across all tabs". Only one of the three is portable, and the
page says which and why rather than shipping dropdowns that do nothing.

**Status scope works, end to end.** The five scopes are copied verbatim from
`DEFAULT_SIM_STATUS_SCOPES` in the original's `sim-consent.js` — ids, labels and
descriptions — and they change who competes in every engine on the site. Held in
a **cookie**, because every portal page is server-rendered and `localStorage`,
where the original keeps it, is not readable while rendering.

Two rules that matter:

- **The scope is never baked into the cache.** `loadPreferenceIndex` is cached
  per induction and shared between readers, so it now carries `statusById` and
  each request derives its own eligible set with `eligibleUnder`. Storing one
  reader's scope in the index would hand that scope to everybody.
- **The default is `accepted`, which is what the engines always did**, so
  `test:cascade` and `test:placement` grade exactly what they graded before. A
  reader who widens it is deliberately asking a different question.

**Merit formula and candidate revision are fixed, and shown as fixed.** A
formula in the original is a definition — which fields to sum, which to add or
subtract — stored in the owner's Firestore, and the second option, "MS/MD Marks
Adjusted", exists only as a definition we do not hold. A revision re-derives
every mark by subtracting a per-field delta over house job, position, MDCAT and
degree; the amendments are ingested and shown on a record, but the engines read
a precomputed total, so applying one means recomputing the pool rather than
flipping a switch. Both are rendered as a fixed value with the reason, not as a
disabled `<select>` — a dropdown promising a choice that does not exist is a lie
the reader acts on.

Any copy that names the scope must read it rather than assume it. Seat
Allocation said "simulated over N **verified** applicants", which stops being
true the moment the scope widens, so it now names the active scope instead.

### Hospitals is a view over `seats`, not a table

`/app/portal/hospitals` and `/app/portal/hospitals/[hospital]`. A hospital is
not an entity with a record in this product — it is whatever the seat matrix
says trains there — so the directory and the profile are both derived from the
873 cached seat rows every other portal page already reads. No table, no ingest,
no migration.

69 hospitals, 1,449 seats, 45 specialties. The profile reproduces the original's
"Seat Distribution by Specialty" table exactly on the data — 17 seats and 10
specialties for ABS Teaching Hospital, matching row for row.

Two deliberate differences:

- **Columns are the programmes the hospital actually trains**, not a hardcoded
  FCPS / MS / MD. The seat matrix has five programmes and the original's table
  can only ever show three, so a dental institute renders as three empty columns
  there. Ours shows dentistry.
- **A missing programme is an em dash, not a zero.** No seat exists to compete
  for, which is a different fact from a seat that exists and is empty.

Addressed by a slug of the name — `abs-teaching-hospital-gujrat` — rather than
the original's `hospital.html?id=3`. That numeric portal id is not a column we
hold, and a slug survives being pasted into a message. Verified unique: 69 names,
69 slugs.

**Training Reviews are not built.** The original's profile ends with
resident-written reviews, rated overall and per aspect. That is a community
feature with its own writes and its own moderation problem, not a view over seat
data, and the page says so rather than ending abruptly.

**Every card in the directory is the same height, and that took two things.**
The first version printed the specialty list as running text — Mayo has 28, a
district hospital has four — so cards in a row differed by a factor of five, and
a grid row is as tall as its tallest cell. `auto-rows-fr` makes the cells in a
row share a height, and the specialty area is a **fixed-height chip cloud**, so
the content stops varying in the first place. Nothing is dropped: every chip is
rendered, the clip is a mask rather than a slice, the count is stated, and the
profile lists all of them against their seats. Measured: 24 cards, one distinct
height, zero within-row difference.

The chips are coloured by **discipline family**, the same palette the merit
table uses, so a reader recognises the colour before reading the word. Each card
also draws seats per programme as a proportional bar — "FCPS, MS, MD" says a
hospital trains three programmes, the bar says whether it is overwhelmingly one
of them, which is what decides whether a preference there is worth spending.

Filtering here is **client-side**, unlike the Candidate Pool roster. The rule
that sent the roster to the database is about a table no request may return
whole; this is a public seat matrix carrying nothing about any person.

### Performance: the bottleneck is payload, not the database

The portal pages were 33–48 seconds. It was **not** a query problem and **not**
connection pooling — `supabase-js` speaks HTTP to PostgREST and the app opens no
Postgres connections at all, so there is no pool to tune. There is no
`DATABASE_URL` anywhere in `src/` or `supabase/`, deliberately.

The cause was volume, re-fetched per request. One page of 1,000 `applicants`
rows is **11.25 MB and 1.9 s** because each row carries a preference list and a
certificate list as jsonb; the whole pool is ~39 MB. Every portal page fetched
it, parsed it, and rebuilt the same 180,784-entry index.

`src/lib/portal/pool-cache.ts` holds three things per induction — the pool, the
published names, the seat rows — plus `loadPreferenceIndex`, the derived index
both engines read. It caches the **in-flight promise** as well as the result, or
two requests arriving together each start their own 39 MB fetch.

**Only cache what does not vary by user.** The pool is service-role and carries
no personal columns; names and seats are Tier 1 and identical for every verified
user. Caching anything read under a per-user policy would turn the cache into an
access-control bypass — if `merit_entries` ever stops being fully visible to
verified users, `loadPublishedNames` must stop being cached.

Result, dev server, steady state:

| Page | Before | After |
| :-- | --: | --: |
| `/app/portal/slots` | 48.5 s | 1.9 s |
| `/app/portal/merit-list` | 38.8 s | 2.1 s |
| `/app/portal/allocation` | 33.0 s | 2.0 s |
| `/app/merit-lists` round 8 | 8.6 s | 2.5 s |
| `/app/portal` | 5.6 s | 0.5 s |
| `/app/merit` | 4.1 s | 0.5 s |

The other half was the RSC payload: the Merit List serialised every seat's
**full** queue — one FCPS slot has 585 entries, across 742 slots — for a list
that is collapsed by default and shows 25 when opened. Queues are now truncated
server-side to `QUEUE_HEAD`, with the true length carried separately so the
counts still describe the real competition.

Truncating the queues was not enough on its own, because the page still sent all
742 seats. Measured in the browser, one round rendered whole against one batch:

| | all 742 seats | first batch of 24 |
| :-- | --: | --: |
| TTFB | 14.8 s | 1.7 s |
| HTML | 7.69 MB | 0.45 MB |
| RSC payload | 4.19 MB | 0.25 MB |
| DOM nodes | 23,893 | 1,180 |

Every card is a client component, so those 23,893 nodes were also 742 components
to hydrate.

### Long card grids load in batches, in place

**Both long grids grow with a "Load more" button rather than paging.** Page
links would have worked for the byte count, but they scroll the reader back to
the top and lose the seats they had already read past, on a page whose whole
purpose is scanning for one seat. `LoadMore`
(`src/components/portal/load-more.tsx`) is shared by both so they behave
identically, and it always states the remainder — "24 of 742 seats shown · 718
more" — because on a list this long the number is what tells the reader to
filter instead of clicking.

The two grids are fed differently, and the difference is not arbitrary:

| | Merit List | Seat Allocation |
| :-- | :-- | :-- |
| Batch | 24 | 36 |
| Next batch comes from | a server action | props already in memory |
| Why | queue heads for 742 seats are 4.19 MB of payload | the slots must all be client-side anyway, or filtering could not run without a round trip per keystroke |

So on the Merit List `moreMeritSlots` fetches each batch, and on Seat Allocation
nothing is refetched — only the markup is deferred, which is what the 2.16 MB /
15,589-node measurement there was made of.

Two rules hold on both:

- **Queues are built after the page slice, not before.** `buildQueue` is the
  expensive half of `merit-list.ts` — it walks everyone who listed a seat,
  180,784 preference entries across the cycle, and sorts each list. Building 742
  of them to render 24 was most of the server cost, and truncating each to 25
  afterwards did nothing about that.
- **Every count is computed before the slice.** `matchedSlots`, `totalSlots`,
  the summary and each queue's true length describe the round; only the rendered
  array is a batch. A filter that matched 300 seats must never report 24.

Changing a filter resets the accumulated batch. Both components compare a
signature of their filters during render and drop what they had — an effect
would paint the stale grid first. On the Merit List the filters are URL state,
so the reset fires on a same-route navigation with the component still mounted;
`?page=` was deliberately not kept, because a URL that opens halfway down a list
with nothing above it is worse than one that starts at the top.

That same "still mounted" behaviour made a latent bug reachable.
`SimulationProvider` holds the reader's consent edits in React state and
survives a filter change, which is what carries a scratchpad across batches.
Across **rounds** it is wrong: the same seat holds different people, so an edit
would be applied to whoever now sits there. The provider clears its overrides
when `round` changes.

### Running the engines

`src/lib/portal/data.ts` reads seats and published names **as the caller**, and
the pool with the service role. Allocation is never cached across requests: the
pool changes when the pipeline runs, and a stale allocation is a wrong answer
that looks authoritative.

Only `profile_status = 1` competes. 2 is Rejected, 11 is Pending and null is no
record — none of those is a cleared candidate, so treating null as eligible
would let unverified people take seats.

**The cascade has a real oracle.** Round *n* is the input and round *n+1* is the
answer, so `test:cascade` grades rather than eyeballs. Agreement runs 89.4% to
94.7% across the seven published pairs, mean 91.8%. It is not meant to be exact:
PHF applies grievance outcomes and manual corrections that no published input
describes.

Two findings worth keeping:

- **Trim all four seat-key fields, not just the quota.** The seats file carries
  trailing spaces on hospital names (`"Nishtar-II Hospital Multan "`) and
  specialties (`"Radiation Oncology "`), and on the `"Armed Force "` quota,
  while consent titles arrive trimmed from the `" - "` split. The original trims
  only the quota, and 36 of round 1's 1,053 consent rows joined to no seat at
  all — each one a real acceptance dropped from the cascade.
- **`Awaited` is not handled consistently by PHF.** Our rule releases the seat.
  In rounds 2 and 4 every awaited candidate was indeed released (0 of 8, 0 of
  6); in round 3, **67 of 78 kept their seat**, which is why round 3→4 is the
  weakest pair. Round 3 evidently ran with an extension. Nothing in the inputs
  says so, so the rule stays as written and `test:cascade` pins the observation
  instead. If that retention count changes, revisit the model — not the
  threshold.

## Commands

```
npm run dev            # dev server on :3000
npm run build          # must pass before calling anything done
npm run fixtures       # regenerate synthetic candidates
SUPABASE_SEED_ALLOW_PROJECT=<ref> npm run seed
SUPABASE_INGEST_ALLOW_PROJECT=<ref> node supabase/ingest/consent-rounds.mjs
node supabase/ingest/consent-rounds.mjs --dry-run   # parse only, writes nothing
npm run test:pool      # Candidate Pool aggregation, fixtures plus the real pool
SUPABASE_INGEST_ALLOW_PROJECT=<ref> node supabase/ingest/pool-directory.mjs
SUPABASE_INGEST_ALLOW_PROJECT=<ref> node supabase/ingest/joining-status.mjs
npm run test:rls       # 35 access-control assertions over the real REST API
npm run test:cascade   # between-rounds cascade, graded against the published rounds
npm run test:placement # blank-slate allocation, graded against published round 1
SUPABASE_INGEST_ALLOW_PROJECT=<ref> node supabase/ingest/portal-inputs.mjs
node supabase/fixtures/make-link.mjs <email> [recovery|invite]
```

Dev accounts (password `devpassword123!`): `candidate00001@example.invalid`,
`admin@example.invalid` (super_admin), `moderator@example.invalid`.

### My Profile, and the two records it keeps apart

`/app/profile`. The original's `candidate.html` is one long page mixing four
things: what the gazette says about you, what you say about yourself, an admin
message inbox, and an invite generator. This is the first two, and it keeps them
**visibly apart** — the difference between a verified mark and a typed-in goal
is the only thing on that page that matters, and running them together makes
"aspiring specialty" look like the same class of fact as a merit position.

`profiles` already had everything needed: `display_name`, `specialty_goal`,
`hospital_goal`, `is_public`, and self-only insert/update policies. No migration.

Goals are **selects over the seat matrix**, not free text — not to stop an
attack, since it is the user's own row, but so the values stay joinable. The
moment a directory matches "everyone aiming at Cardiology", a typed
"cardiology " with a trailing space is a profile that silently matches nothing
and its owner has no way to find out.

**`profiles` needs an explicit `.eq("user_id", …)` on every self-read.** Its
select policy is `own OR is_public OR staff`, so a bare `.maybeSingle()` matches
every public profile, finds more than one row, and errors — which surfaces as
"you have no profile" and a header that falls back to the email. `candidates`
needs no such filter because its policy resolves to one row by construction;
this table deliberately does not. Both reads were wrong on the first pass.

The save `select()`s so it is checked **by effect**, not by status code — the
204-with-zero-rows trap, which this project has now met three times.

### Competition & Demand Index

`/app/portal/competition`. The original's framing, kept: "See how many
candidates applied per seat for each specialty. Higher ratios mean tougher
competition." One row per (specialty, programme, quota), aggregated across
every hospital.

**No new data and no new policy.** Both inputs — `loadPool` (service role,
cached) and `loadSeats` (as the caller, cached) — are already loaded by every
other portal page. The grouping algorithm is read out of the deployed site's
own `buildCompetitionData` function via the browser console, applicant-counting
rule included: a candidate who lists three hospitals under the same
(programme, quota, specialty) counts **once**. Verified against the live site:
same top rows, same bar widths to four decimal places (66.1355%, 56.7065%).

**Deliberately does not honour the Config tab's status scope.** Checked on the
deployed site — `SIM.candidates.length` is 3,474 while the default status scope
holds 3,289 — so the live page reads the whole pool regardless of verification.
Demand is a fact about who applied, not about who cleared verification, and the
port matches that rather than "fixing" it toward consistency with Config.

**Two differences from the original, both stated on the page:**

- **No 150-row cap.** The original caps its table and prints "Showing top 150
  results" to keep a slow client-side render smooth. The whole matched set here
  tops out around 160 rows of plain text — cheap to render server-side once —
  so nothing is cut.
- **The count label is fixed.** The original prints "N specialties shown" for a
  number that is actually rows — one specialty appears in several rows under
  different programmes and quotas, confirmed 163 rows against roughly 45
  distinct specialty names. Ours says "combinations" and explains the unit in
  a sentence under the stats bar.

One row the original has and this cannot: a handful of its preferences carry no
specialty name, rendered there as the literal string `"undefined"`. Our ingest
resolves every specialty id already (`MISSING_SPECIALTY_IDS`), so zero rows in
`applicants.preferences` have a blank specialty — checked directly — and that
row cannot occur here.

### The account menu

`src/components/app/user-menu.tsx`, in the `(app)` header. It absorbed three
controls that were sitting loose there — the email address, the theme toggle and
the sign-out button — because they are all answers to "this is me, and here is
what I can change about that". The original's header does the same with one
"My Profile" link beside logout.

Both reads behind it are the caller's own row under policies that already exist:
`profiles` is self-readable, and `user_roles` has **no client write policy at
all**, so a "Staff" badge shown here cannot be one the holder granted
themselves.

Three ways to close it, and the third is the one that bites: pointer-down
outside, Escape, and a **route change** — every item is a `Link`, so without
that the menu hangs over the page it just opened. The outside handler listens on
`pointerdown` rather than `click`, or the trigger's own handler reopens it in
the same gesture and it never shuts.

The avatar is an **initial, not a photo**. `profiles.avatar_path` exists and the
original lets a candidate upload one, but nothing writes it here yet, and a
broken image in the header would read as the app failing rather than as a
feature not built.

### The portal has its own header strip

`/app/**` opens with the daily Quranic verse (`VerseStrip`). **`/app/portal/**`
does not** — it uses `PortalQuoteStrip`, a rotating strip of 29 medical
quotations, exactly as the original does. The verse is not removed from the
product, it is swapped for a different register on the one surface where a
candidate is watching a live cycle decide their career. The quote list keeps its
own Islamic section at the top, so nothing is lost.

Attributions are the original's, hedging included ("attributed") — upgrading a
disputed quotation to a firm one would be inventing provenance.

### Find my position

`findMyPosition` looks an applicant id up in `merit_entries` — Tier 1, read **as
the caller** — and the id is then kept in `localStorage` so the reader's rows
carry a `you` marker wherever they appear. Nothing is written to the server.

An applicant id is not a secret: 3–5 digits, printed on every published merit
list, and the historic leak published all of them. So this returns only what the
gazette prints, and an id that has never been published returns the *same*
answer as one hidden by RLS — distinguishing them would confirm whether a given
doctor is in the cycle.

### Add me manually

A candidate absent from every published round cannot be found in the portal at
all, so they can supply themselves: name, aggregate marks, and an ordered
preference list built from the real seat table.

**It never reaches the database.** It is held in `localStorage` and passed to
`simulateNextRound` as an argument for one run. Nothing verifies it — a form
anyone can type into is not evidence — and a table of self-asserted marks
sitting beside the ingested gazette would be indistinguishable from it within a
month. Their id is forced into the manual range (`MANUAL_ID_BASE` = 990001, well
clear of the real 2255–39524) on arrival, so a caller cannot pass a real
applicant id and have invented marks merged into a real person's run.

**Standing matters more than placement, and this is the trap.** The cascade only
fills seats that become *vacant* — it moves people between rounds rather than
reallocating — so a new entrant with the highest marks in the cycle still takes
nothing unless a seat on their list opens. A seat with no published occupant is
never queued at all and stays empty for the whole run. Reporting only "not
placed" reads as the feature being broken, so the result also carries a per-seat
**standing**: rank among everyone eligible who listed that seat, against its
capacity. That is computed from the cached preference index, not the run, so it
holds regardless of vacancy.

The modal renders through `createPortal` into `document.body`. `<Reveal>`
carries a transform and would otherwise become the containing block for its
`position: fixed` — the trap that already cost a mobile sheet on the merit table.

**Which surfaces include it, and why that split is the original's.** Checked in
the original's source rather than assumed:

| Surface | Reads | Manual candidate |
| :-- | :-- | :-- |
| Merit List / next in line | the fetched file directly | **no** |
| Where Merit Falls | `allCandidates()` | yes |
| Seat Allocation | `allCandidates()` | yes |
| Candidate Pool, Consent What-If | `allCandidates()` | yes (unbuilt here) |

`sim-merit-list.js` never calls `allCandidates()` — zero occurrences in 2,143
lines — so adding yourself does not put you in a Merit List queue on the live
site either. We match the split rather than improving on it.

The two surfaces that do include it are server-rendered, and `localStorage` is
not readable while rendering. So they render without the manual candidate and
the client calls `allocation-action.ts` to re-run with them. Everyone without an
entry gets the fast path and waits on nothing.

**`loadPublishedNames` is cached and shared.** Adding the manual candidate to
that map directly leaks one reader's self-supplied name into every other user's
pages until the cache expires. Both `runAllocation` and `simulateNextRound` copy
the map before writing to it, and only when there is something to add.

### Schedule times are Pakistan wall-clock

`induction21_schedule.json` writes `"2026-05-15T00:00:00"` with **no offset**,
so `new Date()` reads it in whatever zone the process is in. These are PHF
deadlines set in Pakistan. The first version rendered them converted to UTC and
every window came out five hours early — "opens 14 May, 19:00" for one that
opens at midnight on the 15th.

The components are parsed textually and rebuilt with `Date.UTC`, which preserves
the digits, and the page labels them PKT. "Now" is shifted into the same frame
before any comparison, or the phase would be wrong in the other direction.
Pakistan is UTC+5 year-round with no daylight saving, so a fixed offset is
correct rather than a simplification.

A step's `statusId` also overrides its dates: **21** means finished whatever the
range says, **11** means live so the dates decide, and **0** with start equal to
end is a placeholder the portal wrote at row creation — rendered as "date not
published" rather than announcing a deadline that does not exist.

Only the raw file is cached. Caching the computed phases would leave a step
reading "Open now" hours after it closed.

### Simulate Next Round

`src/lib/portal/simulate.ts` is the server action behind the Merit List's
simulate button. It builds the cascade's inputs from the round on screen, layers
the reader's consent edits on top, runs `runCascade`, and returns a **change
log** — not a replacement grid. The grid keeps showing the published round,
because the point is to compare against it; swapping it for simulated occupancy
loses the reference and invites reading a prediction as a published fact.

**It reads the pool with the service role, so it gates first.** The check reuses
the existing policy rather than restating it: `seats` is readable only by a
verified user, so if reading it as the caller returns nothing, the action stops.

**The engine keeps the file shapes.** `cascade.ts` takes the raw PHF shapes,
because that is what `test:cascade` grades it against; changing it to suit the
database would invalidate the oracle. `simulate.ts` adapts instead — synthesising
specialty and programme ids over the names the database stores, and re-mapping
certificate programme ids into the same numbering. Miss that last step and no
bonus ever matches, so every effective mark silently collapses to the bare
aggregate.

## Testing discipline

**Logic tests run under plain `node`, no test framework.** They import the real
module so the thing under test is the shipped code, not a copy:

```js
const { applyQuery } = await import("./query.ts");   // explicit .ts extension
```

That import style only works from a `.mjs` test file. A `.ts` module that needs
testing must therefore be **dependency-free or relative-only** —
`src/lib/predict/predict.ts` imports types only for exactly this reason, and
`tsconfig` rejects a `.ts` extension in a real source import.

**Pin arithmetic against the live site's own output.** `test:calc` reproduces
its 23.64/30 breakdown; `test:predict` reproduces 99th percentile and
1409/61/0. Both caught real bugs — rounding applied after clamping, in two
different places.

`test:compare` pins the comparison matrix, including the two figures that are
**recomputed rather than read**. `Std Deviation` in the source is the spread of
raw marks across cycles whose totals ran 95, 60, 35 and 30, so it mostly
measures the policy being rewritten: one real seat reads 15.90 there and 7.77 on
the normalised scale. The test also asserts that the normalised mean equals the
file's own `avg_pct_of_max`, which proves the recomputation runs over the same
observations — the scale changed, not the sample.


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

**UI / hydration**
- `color-scheme` must be declared per theme in `globals.css`. Native controls —
  the `<select>` popup list, scrollbars, date pickers — are drawn by the OS, not
  by our CSS, so without it a dark page opens a white dropdown. It only selects
  the OS's generic light or dark chrome, so scrollbars are additionally themed
  in `globals.css` with **both** `scrollbar-color` (standard; Firefox and
  Chrome 121+) and `::-webkit-scrollbar` (older Chromium and WebKit). Their
  colours derive from `--border-strong` and `--fg-subtle`, so no scrollbar
  colour is restated in a dark block.
- **Focus must not change a control's fill.** `focus:bg-surface` on the shared
  field styles lifted a control from `surface-sunken` to `surface` on focus.
  Clicking a `<select>` focuses and opens it at once, so the control flipped to
  the card background at the moment of interaction and read as broken — and the
  last-used select then stayed a different colour from its neighbours. Focus is
  border plus ring, nothing else.
- The `@hugeicons-animated` icons render a **`<div>`**. Putting one inside a
  `<p>` or a `<span>` is invalid HTML and throws a hydration error — make the
  parent a div.
- `<Reveal>` carries a `transform`, which makes it the containing block for
  `position: fixed` descendants. Never wrap a subtree containing a modal or
  bottom sheet in it: the sheet will anchor to the wrapper, not the viewport.
- `IntersectionObserver` never fires for an element already **above** the
  viewport, so a reveal-on-scroll component must show anything already on or
  past the screen immediately, or restored scroll positions leave content at
  `opacity: 0` forever.
- Radius scale is `sm` / `md` / `lg` and nothing larger on app surfaces. See
  DESIGN_GUIDELINES §1.5.
- **A rotating text strip needs its height reserved, not just its width.**
  `PortalQuoteStrip` had no min-height, so a quote that wrapped to two lines
  made the `<aside>` taller and pushed every section below it down on rotation
  — a layout shift with nothing to do with data loading. Measured the actual
  worst case rather than guessing: the longest of the 32 quotes wraps to
  **three** lines at `sm` (640px), so the reservation is `min-h-[4.875em]`
  (three lines at `leading-relaxed`), in `em` so one value covers both the
  mobile and `sm:` font sizes. The reservation belongs on a **wrapper**
  around the `<p>`, not on the `<p>` itself — making the paragraph `flex`
  would hand its own text to flexbox's item layout, which does not reflow
  across lines the way normal block text does, and would have silently
  stopped the quote wrapping at all. Measuring also surfaced a second bug:
  uncapped, the 32 fixed-width dots ate over half the row at 640–1024px and
  squeezed that same quote to **five** lines, which is what a three-line
  reservation alone would not have covered. The dot row now carries
  `max-w-[30%]` and scrolls.

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

## What is not built

`NOT_IMPLEMENTED.md` is the standing list of everything the original has that
this rebuild does not, checked against the deployed site and tagged by reason —
**scope** (needs doing), **data** (source we do not hold), **decision** (changes
the security posture, so the owner's call), **declined** (deliberately not
ported, with the reason). It also records the places where a built page differs
from the original on purpose.

Update it when a tab ships or a decision changes. A list that drifts is worse
than none, because the next person plans from it.

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
