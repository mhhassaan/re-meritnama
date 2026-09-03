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
| 19 | Consent What-If | `/app/portal/consent` | built |
| 20 | Scoring Policy History | `/app/policy` | built |
| 21 | Guide | `/app/guide` | built |
| 22 | Community Profiles | `/app/portal/profiles` | built |
| 23 | Data Changes | `/app/portal/changes` | built |
| 24 | Accredited Programs | `/app/accreditation` | built |
| 25 | Job Openings | `/app/jobs` | built |
| 25a | Editorial | `/app/editorial` | built |
| 25b | Support | `/app/support` | built |
| 25c | Announcements (staff) | `/app/admin/notifications` | built |
| 26 | Discussion | `/app/discussion` | built |
| 27 | Community Feed | `/app/community` | built |
| 28 | Chat | `/app/portal/chat` | built |
| 29 | Moderation queue | `/app/admin/reports` | built |

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

**Cards come in two weights, and the quiet one is the landing's.** `Bezel` still
defaults to the double enclosure — recessed tray, inner plate, lit edge, ambient
shadow — and `<Bezel quiet>` renders a single surface with one hairline and no
shadow. The owner asked for the app's boxes to read closer to the marketing
pages, starting with `/app`.

Worth recording *why* the obvious fix was wrong: the hairline was never the
problem. `--border` is 8% and already soft. What reads as a heavy box is a card
built from four steps of value at once — measured on `/app`, page `#0f2825`,
tray `#0b1e1c` at 70%, plate `#143733`, plus
`0 12px 32px -12px rgba(0,0,0,0.55)` — where the landing uses one step and a
hairline. Lowering the border token would have washed out every divider,
table rule and input on the site and left the boxes looking exactly as heavy.

Both variants take the same props, so moving a surface between them is one word
and never a layout change. Roll-out is per page, deliberately.

**Quieter borders were not enough on their own — the count of boxes is the
other half.** The standing instruction from the owner is that **only what
absolutely needs a box on that page gets one**. Two rules came out of applying
it to `/app`:

- **A page's own opening never gets an enclosure.** The hero is the page's
  eyebrow, headline and calls to action; there is nothing there it needs
  separating from, and a box around the top of a page draws a line between the
  page and itself.
- **A grid of link targets needs boundaries, not boxes.** Hover is a fill
  (`hover:bg-surface`), not a border change — a border that appears on hover
  reintroduces the box being removed.
- **The seam is drawn by the cells, never by the container.** `gap-px` with
  `bg-border` on the container looks equivalent and has a bug that only shows
  when the items do not fill the last row: the empty cells are still inside the
  container's box, so it paints them as a slab of border colour. Five items in
  four columns is three such cells. Each cell carries `-ml-px -mt-px border-l
  border-t border-border` instead, so a cell that does not exist draws nothing,
  and the container is `overflow-clip` to trim the overhanging first row and
  column. `HairlineGrid` / `HairlineCard` do this; `HAIRLINE_CELL` and
  `HAIRLINE_TRACK` are exported for the places that need a real `<li>` or an
  existing card component. Cells on the page take `bg-background`, cells inside
  a `Bezel` take `bg-surface`.
- **A single-column `flex flex-col gap-px bg-border` stack is still correct** —
  a column has no incomplete row, so there is no empty cell to paint.

What survives on `/app`: the eyebrow pill, the secondary button's outline, and
the one aside carrying the candidate record or its absence — content of a
different class sitting beside the hero, which is exactly the case an enclosure
is for.

**This is now the whole app, not one page.** `Bezel`'s default *is* the flat
card and the enclosure is opt-in behind `enclosed`, which nothing currently
uses — so all 183 call sites moved at once. On top of that, every repeated grid
or stack was converted to a hairline: `HairlineGrid` / `HairlineCard`
(`src/components/app/hairline-grid.tsx`), or its construction written out where
the markup needs a real `<ul>`.

The worst offenders and where they landed, counted from the rendered HTML:

| Page | Before | After |
| :-- | --: | --: |
| `/app/portal/joining` | 693 | 14 |
| `/app/portal/seats` | 59 | 14 |
| `/app/guide` | 53 | 11 |
| `/app/portal/changes` | 44 | 14 |
| `/app/policy` | 41 | 13 |
| `/app/portal/schedule` | 41 | 11 |
| `/app/portal/merit-list` | 50 | 26 |
| `/app/jobs` | 26 | 14 |

About ten of the remainder on any page is the shell — the header, the nav rail,
the account menu — so a page reading 11–14 is close to carrying no card of its
own.

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

**Training Reviews are built, and cost almost nothing** because the community
work had already built everything they needed. A review is a `community_posts`
row with `kind = 'hospital_review'` — same authorship trigger, same rate limit,
same report button, same moderation queue. The migration added four columns
(teaching, work-life balance, seniors' support, training year) and one index.
No new table, and deliberately so: a separate one would be a second copy of
every moderation rule and the first place they would drift apart.

Two rules on the numbers:

- **Averages count only visible reviews.** The select policy still returns a
  reader their own hidden review, so averaging everything returned would show
  that author a different score from everybody else — and let a removed review
  keep influencing the score it was removed for.
- **An unrated aspect prints "not rated", never 0.** The three aspects are
  optional; a zero reads as the worst possible score rather than an absent one.
  The same distinction the Data Changes work turned on.

The directory card shows the average and count, from one grouped query for all
69 rather than one per card, and shows nothing at all for a hospital nobody has
reviewed — an always-present rating slot would print an empty score for 68 of
69 and read as a bad rating.

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
SUPABASE_INGEST_ALLOW_PROJECT=<ref> node supabase/ingest/data-changes.mjs
npm run test:rls       # 88 access-control assertions over the real REST API
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

### Consent What-If, and the engine it is actually built on

`/app/portal/consent`. The original's framing, kept: "Compare normal seat
allocation with a rerun where one candidate does not consent. The report
shows the released seat, who moves in, and the subsequent candidate list
changes."

**Hidden on the live site right now, and that is not a reason to skip it.**
Its own `applyMode('merit-list')`, in `sim-merit-list.js`, sets
`display: none` on `[data-tab="slotbrowser"]` and `[data-tab="consent"]`
together whenever a merit list has published for the cycle — which Induction
21's has. The pane's markup and `sim-consent.js` both still ship regardless.
Same precedent as Where Merit Falls and Seat Allocation, hidden by the
identical gate and built here anyway: the feature is the live experience in
the phase of a cycle where that gate has not yet fired, and a stale nav is
not the same thing as a retired feature.

**It runs on `runPlacement`, not `runCascade` — read `sim-consent.js` itself
to be certain rather than assuming.** An earlier pass through this list
described it as "a narrower entry point into the cascade that powers Simulate
Next Round." That was wrong, and worth recording precisely because it was a
plausible-sounding guess that turned out false: the original's
`runConsentWhatIf` calls `runPlacementFromPool`, which is the same
deferred-acceptance blank-slate algorithm behind Seat Allocation. "No
consent" means removing the applicant from the whole programme's pool and
running blank-slate placement again from scratch — every seat is
recontested, not just the one they held. That is also why the ripple can
reach candidates who never listed the released seat at all. Verified against
real data: removing applicant 34773 from FCPS released one Diagnostic
Radiology seat at Nishtar Hospital and set off a six-hop chain through five
other candidates, none of whom held preferences anywhere near each other
except through the seats each was already occupying.

`src/lib/portal/consent-whatif.ts` shares its fetch with `runAllocation` —
`loadPool`, `loadSeatRows`, `loadPreferenceIndex`, all already cached — and
runs `runPlacement` twice: once for the baseline, once with the target
applicant filtered out of the candidate list. The diff needs no roster of
"who did not change" — a candidate absent from both runs' placed-lists never
appears in either lookup map, which produces the same silence a full
before/after record with `.placed === false` on both sides would have,
without building one. "Show if candidate consents" skips the second run
entirely and reuses the baseline as its own variant, since the two are
definitionally identical.

**Cost is real and stated as such.** Two full placement runs, sequentially —
measured warm at ~4.1 s against the real FCPS pool, almost exactly double the
single-run Seat Allocation page's 2.0 s. An explicit "Run" click with its own
loading state, the same UX class as Simulate Next Round, not a page load.

**Changed-candidate rows stay capped, unlike Competition's table.** A
blank-slate re-run can genuinely displace hundreds of people — a domino, not
the cascade's localised vacate-and-refill — so the 60-row cap that removed
itself from Competition (~160 rows, cheap) stays here, with the true count
carried alongside it.

Nothing here is written anywhere. The scenario record is `localStorage` only,
capped at 8 like the original's, the same pattern `FindMeBar` and
`AddMeModal` already use: an applicant id is not a secret, but a server-side
log of who has been asking "what if" about whom is not something this page
needs to hold.

### Policy and Guide, and why the policy file needs a timeline read

`/app/policy` and `/app/guide`. Both are presentation over data three other
surfaces already load — `loadPolicies()` for the formula history, and the
constants in `src/lib/predict/predict.ts` for the glossary's numbers. No new
data source, no new policy, no migration.

**`policy_by_induction.json` cannot tell "removed" from "not yet introduced"
on its own, and getting it backwards inverts the meaning.** Every cycle in
that file lists all twelve components, with `included: false` and zero marks
for the ones not in force. So MDCAT — introduced in Induction 20 — carries
`included: false` all the way back to Induction 8, and rendering that flag
directly labels it "dropped" in 2020, which says the opposite of what
happened.

`loadPolicyHistory` resolves it from the timeline instead: a component's
first marks-carrying cycle is found by scanning ascending, and anything
before it is `pending` (rendered as a dash) rather than `dropped`. Verified
on the real file in both directions — MDCAT reads `— — 2 2` and Matric reads
`5 5 dropped dropped`. Hard Area Service is the case that proves the rule
works in the middle: introduced at Induction 17, dropped at 20.

One component, `attempts_in_mbbs`, never carried marks in any held cycle. It
is excluded from the matrix — a row of dashes says nothing — but **named
underneath it**, because the Calculator lists it under "no longer counted"
and a reader who saw it there and not here would reasonably wonder which page
was wrong.

**The Guide's numbers are read out of the code, not copied from the
original.** A glossary drifts silently, and it is trusted exactly where a
reader cannot check. Two of the original's entries are corrected rather than
ported: its quota list ("Open Merit, Women, Disabled, Minority") is not what
our seat matrix contains — the real names are Punjab, Armed Force,
AJK/G&B/ICT, KPK/Sindh/Balochistan, Foriegn, Disable, Dental, Placement, the
misspellings included because a filter has to join to what the portal
publishes — and its "hand-edit `data/current_merit.json`" FAQ describes a
static site, not this one.

FAQ entries are `<details>`, not click-to-toggle divs: open before hydration,
findable by the browser's own in-page search, and no state to manage.

### Community Profiles, and a promise that governs the page

`/app/portal/profiles`. The original's framing: "Browse registered members
who have shared their profile. Data is self-reported and shown publicly by
the user."

**No new policy was needed.** `profiles_select` has been
`own OR is_public OR staff` since the table was created, so a directory of
people who opted in already worked. Worth contrasting with the Candidate Pool
roster, which needed a new table *and* an explicit owner decision — because
nobody in that one opted into anything.

**A card carries three fields, and that is fixed by copy already on screen
rather than by taste.** `/app/profile` tells anyone ticking the
discoverability box, in these words: *"other verified candidates can see your
display name and your two goals — and nothing else. Your email, your marks,
your preferences and your applicant id are never part of it."* The original's
cards carry a merit band ("Top 50%"), inducted status and programme tags —
every one derived from marks or the preference list, which is exactly what
that sentence rules out. Adding any of them would retroactively falsify the
consent text people ticked the box under.

**`.eq("is_public", true)` is load-bearing, not decoration.** The policy is
`own OR is_public`, so without that filter the caller's *own private profile*
comes back and appears in a directory they never opted into. Verified against
the dev data, where the signed-in account is deliberately the private one: 3
public rows listed, own private row absent.

**The private-profile count is not shown.** The original prints "66 members
have a profile but have set it to private", which it can because its rules
let the browser read every row. RLS hides those rows from us, so the number
would require a service-role read to produce a cosmetic line. The page states
the rule instead.

Status filter is replaced by specialty. The original filters All / Inducted /
Applicant; inducted status comes from the joining export, which this page is
not permitted to read, and specialty is what people actually look each other
up by. The facet list is queried unfiltered, so choosing a specialty does not
then empty the dropdown that chose it.

### Data Changes, and the zero that is not a score

`/app/portal/changes`, from `candidatesChanges.html`. The original's framing:
compare the previous snapshot of the applicant file with the current one and
show what changed, by how much, and for which candidates.

**The source is a precomputed diff, not the 78 MB files.** The portal publishes
`candidates_changes.json` — 622 candidates, 4,035 records before and 4,045
after. The original fetches it whole into the browser. `data_changes` and
`data_change_runs` hold the part of it that is safe to keep, and
`supabase/ingest/data-changes.mjs` reads the source field by field so the rest
cannot arrive by accident.

**Three things are withheld, and the first two match the original rather than
diverging from it:**

- `cnic` — 397 of the 622 records carry one. The string "CNIC" appears nowhere
  on the original's rendered page either, so it never shows these values; it
  simply ships them to every browser.
- the old and new `nameFull` strings — 400 records. The original prints both,
  with parentage. Only the **fact** that a name record moved is kept, as
  `field = 'name'` with no values. Names on the page come from `pool_directory`,
  where a father's name is stripped at ingest and the three CNIC-as-name records
  are withheld.
- the individual preference seats — 19,587 additions, 1,420 removals, 788 edits,
  up to 357 on one candidate.

**But the preference counts are kept, and dropping them was a bug.** The first
version withheld preferences entirely, and 113 of the 622 changed records
changed *nothing else* — so the page showed 509 candidates where the original
shows 622. The per-programme counts (`prefAdded`, `prefRemoved`, `prefEdited`,
`prefCount`) restore them without a second copy of the cycle's preference data.
The seats themselves are already readable per candidate on the Candidate Pool.

**The framing correction, which is why this is not a straight port.** The
original prints, on every one of its 440 total-marks rows, a sentence in the
second person: *"Your total went up by 17.1343 points."*

That is true of almost none of them. **A zero in the applicant file means no
record, not a score of nought.** 358 of the 440 move from 0 to a real mark and
25 move the other way — records being populated and blanked as the portal
finished data entry. Only **57** are a revision between two real values, and
most of those are a bare MDCAT score becoming a full record (1.63 to 17.38).
A candidate reading the original's page sees hundreds of people apparently
gaining fifteen points and concludes the merit list is unstable.

Every row carries a `kind` from ingest — `appeared` / `vanished` / `revised` /
`added` — and the page leads with the breakdown before the table, because a
reader who scrolls straight into the list has already been misled.

**The original's three sections are one dataset filtered three ways**, and its
own "Browse All Changes" already carries a "Marks changed" chip — so the presets
are its idea, not a departure. Counts match it exactly: 622 all, 440 marks, 365
programme marks, 10 new.

**Filtered in the browser, not the database.** 622 candidates and 3,806 field
changes is a few hundred kilobytes, small enough that search runs per keystroke;
only the markup is deferred, in batches of 30, the arrangement Seat Allocation
uses. Nothing is cached across requests — the tables have a per-user policy, and
a cache over one of those is an access-control bypass waiting for the day the
policy narrows.

### Accreditation, and a dataset that was never missing

`/app/accreditation`, from `accreditation.html`. CPSP's register of accredited
FCPS training: 5,587 programmes, 537 institutions, 92 cities, 92 specialities.

**`NOT_IMPLEMENTED.md` had it tagged `data` — a CPSP dataset we do not hold —
and that was simply wrong.** `public/data/cpsp_accreditation.json` had been in
the repo the whole time, 849 KB, 542 hospital records. Nothing needed
ingesting, no table, no policy, no migration. Check the directory before
tagging something blocked on data.

It is the one dataset here with **no personal data of any kind** — a hospital,
a city, a speciality, a unit, a code and a date — so it belongs in `public/`
beside the other aggregates. It is still read server-side with `readFile` and
filtered before rendering, so the 849 KB never reaches a browser; the original
fetches the whole file and renders all 5,587 rows into the DOM at once.

Filters are **URL state**, unlike the Data Changes browser. A filtered view
here is worth sending to somebody — "Cardiology in Lahore" is the shape of the
question people ask each other — and the original's version cannot be linked
to at all. Batches come from a server action behind the shared `LoadMore`.

**Three things in the source are left uncorrected, deliberately, and the page
says so:**

- `unit` is written as both `Unit-I` and `Unit-1`. Normalising would tidy the
  column and silently misquote CPSP.
- 58 of the 5,587 rows are byte-identical to another row, and some institutions
  are listed under several spellings — King Edward appears three ways, each
  carrying Cardiology Unit-I from the same date, so filtering to Cardiology in
  Lahore returns three rows for one unit. Collapsing the exact duplicates would
  be safe but would make the headline disagree with CPSP's own; collapsing the
  spellings needs a fuzzy match and a canonical name CPSP has not chosen. The
  page states what a row is, above the table rather than under it.
- `F.A.` / `P.A.` / `T.A.` are printed as codes. Neither the register nor the
  official page carries a key for them, so nothing here expands them — what
  can honestly be said is the distribution, and F.A. covers 98.6%. They are
  **badged in the original's colours** (F.A. green, P.A. amber) off our status
  tokens, so they flip with the theme. The original has no rule for `T.A.` or
  for the one written-out phrase and renders those uncoloured; so do we, since
  assigning a severity CPSP has not published is the same invention as
  expanding the codes into words.

The Since column carries **both** formats. This site's readable one is the
default — `DD-MM-YYYY` is exactly the ambiguity that produced three separate
bugs in this project — and one button switches it to the register's own string
for anyone checking a row against the official page. `AccreditationRow` keeps
`sinceRaw` beside the ISO date, which also means an unparseable date shows what
the source said instead of a dash. The choice is held in `localStorage` and read
in an effect rather than during render: seeding state from `localStorage`
directly makes the first client render disagree with the server's HTML and fails
hydration.

**`SpecialtyLabel` is not used on this table**, and the reason generalises:
`familyOf` falls back to `"medical"` for an unknown name, and it is built for
the seat matrix's 44 specialties. CPSP publishes 92 of its own, uppercase and
differently spelled, of which **75 fall through to the default** — all five
dental programmes included, screen-reader label and all. A silent wrong family
on thousands of rows is worse than no colour. Any surface joining a foreign
vocabulary to that map must check the hit rate first.

**The dates are `DD-MM-YYYY`** — the third source in this project with that
shape, after the joining export and the schedule. The original sidesteps it by
printing the raw string; the components are read textually and rebuilt as ISO
here so the column formats like every other date on the site.

### Jobs, and a flag that is frozen at scrape time

`/app/jobs`, from the analysis app's `#tab-jobs`. The original's framing:
"Browse current medical job openings. Filter by role, organization, location,
or status." The rest of its sentence — "deadlines and availability update
live" — is the one thing not carried over, because it is not true of its own
page.

**Every posting carries an `isOpen` boolean written by the scraper when it
ran, and nothing recomputes it.** Checked on the deployed site: 149 of 153
postings show a green "Open" dot, and the first card in the grid is a job whose
stated deadline was 5 July 2026. Its detail modal prints "5 days left" against
a job that closed 26 days earlier.

So `isOpen` is never read. Status and every countdown are derived from the
deadline against the day the page renders — in **Pakistan's** wall clock, since
these are deadlines set by Pakistani employers and printed in Pakistani
newspapers. Only the parsed file is cached; caching a computed "Open" would
recreate the original's bug with an expiry attached, the same reasoning that
keeps the portal schedule's phases out of its cache.

**What we hold is a snapshot, and this one really is data-limited.** Unlike
Accreditation, the missing piece is real: `public/data/jobs.json` is 75
postings scraped from jobz.pk on 11 July 2026, and the deployed site shows 153
because its Jobs tab reads a **Firestore** collection that the snapshot only
seeds — `syncJobsFromSource`, `_mergeJobsIntoFirestore`, `_subscribeJobs` in
its own code. That project is the owner's and is out of scope.

Every deadline in the snapshot has passed, so the page currently reports 0 open
and 75 closed. It says that at the top, in those words, before anything a
reader could act on, and the status filter deliberately does **not** default to
"open" — opening on an empty board reads as the feature being broken rather
than the data being old. Nothing is pinned to the July dates: drop in a fresher
file and the same code reports whatever is actually open.

**Three source fields are not carried.** `raw` is a second copy of every parsed
field as scraped key-value pairs. `image` is null on all 75.
`onlineApplicants` reads "Be among the first 25 applicants" — that is jobz.pk's
own interface copy, and reprinting it would attribute their marketing to the
employer.

`arrow-up-right-01` was added from `@hugeicons-animated` for the "open the
original posting" link. Checked afterwards, as the registry section requires:
no `var(----chart-1)` bindings and no `.dark` block were injected this time.

### Profile photos, and the select policy that had to be added back

`profiles.avatar_path` had existed since the table was created with nothing
writing it. It now has a control on `/app/profile`, and the photo appears in
the account menu, on the profile page, and on a Community Profiles card.

**The bucket is private.** A public Supabase bucket serves its objects at a
stable URL with no authentication, forever, and that is the exact shape of the
original's failure. What a candidate opts into is being visible to other
verified candidates; that is not consent to a permanent unauthenticated URL
carrying a photograph of their face beside their name and their cycle. Another
candidate's photo reaches a browser only as a signed URL minted server-side,
one batch request per page rather than one per card.

**The select policy was removed and then had to be added back, and the reason
is worth knowing.** The first version had insert/update/delete scoped to the
uploader's folder and deliberately **no** select policy, so nothing client-side
could read the bucket at all. Every upload then failed with *"new row violates
row-level security policy"* — an error naming the insert, caused by the read:
`upsert` makes storage-api run `insert … on conflict do update`, which has to
read the existing row first. Scoping the select to
`(storage.foldername(name))[1] = auth.uid()` restores the upload and keeps the
property that mattered — nobody can enumerate the bucket or fetch someone
else's photo by guessing a path. `test:rls` asserts that directly, and its
listing assertion expects **one** entry rather than zero, unlike
`payment-proofs`: the caller sees their own folder and no other.

**The consent copy had to change first, not after.** `/app/profile` promised
anyone ticking discoverability that other candidates see "your display name and
your two goals — and nothing else". A face is not covered by that sentence, so
the wording now names the photo. This was safe to do only because **zero
avatars existed** — checked before building — so nobody's photograph can have
been published under wording that did not mention it. The same check is what
any future widening of that promise needs.

**Images are downscaled and re-encoded in the browser before upload.**
`src/lib/profile/compress-image.ts`. Three reasons, in order of weight:

- **It strips EXIF.** A phone photo carries the camera model, a timestamp and
  very often the GPS coordinates it was taken at. Uploading one verbatim puts a
  candidate's home address in our bucket as a side effect of them choosing a
  picture — data nobody asked for, nobody displays and nobody would think to
  look for. A canvas re-encode carries none of it, because the encoder is handed
  pixels rather than a file.
- **It makes the control usable.** An avatar renders at 24, 40 or 72 CSS pixels.
  A 4032×3024 phone photo is several megabytes to fill a 144-pixel circle, and
  the 2 MB limit would simply refuse it. Measured: a 16.9 MB 3000×2000 source
  became a 93 KB 512×341 WebP.
- **The stored bytes are the browser's, not the file's**, so a mislabelled
  content type cannot pass through unchanged. Useful, and *not* a security
  control — this runs client-side. What contains the risk is still the private
  bucket, never rendering as HTML, and refusing SVG.

Three details that each cost a bug or nearly did:

- `createImageBitmap(file, { imageOrientation: "from-image" })`. Dropping the
  metadata drops the "rotate 90°" tag with it, so the rotation has to be applied
  during decode or every portrait phone photo lands sideways.
- **The re-encode is kept even when it is larger.** The first version returned
  the original whenever it had not shrunk, which is right on bytes and wrong on
  the point: a small image can still carry coordinates, and passing it through
  to save two kilobytes against a two-megabyte limit trades the privacy property
  for nothing.
- `canvas.toBlob` does not report an unsupported type — it silently produces
  **PNG**, which for a photograph is several times larger than the JPEG it
  replaced. The result's own `type` is checked rather than trusted.

The size check runs on the *result*, not the chosen file, or a large photo that
compressed fine would still be refused. The type check runs on the chosen file,
so a 12 MB TIFF is rejected for what it is rather than decoded first.

**Not `next/image`, anywhere.** The source is a signed URL that expires within
the hour, so there is nothing stable to optimise or cache, and adding a remote
pattern for the storage host would let any object in that bucket be proxied
through our own domain.

The file input is `hidden`, not `sr-only`. An `sr-only` file input leaves a
second, unlabelled "Choose File" in the accessibility tree beside the button
that already opens it — confirmed in the a11y snapshot before it was changed.

### Community: the first place one user writes what another reads

Discussion (`/app/discussion`), the Feed (`/app/community`), Chat
(`/app/portal/chat`) and the moderation queue (`/app/admin/reports`). One
schema, one set of policies, four surfaces.

Everything below is enforced in the **database**. The server actions shape
input and turn a policy refusal into a sentence a person can act on; they are
not the control. The tempting shape for a forum is to check "is this mine?" in
an action and write with a client that can do anything, and this project has a
standing rule against exactly that.

**Authorship is taken from the session, never from the payload.** The
original's new-thread form opens with a free-text name field defaulting to
"Dr. Anonymous" — which is why nearly every post on its live forum reads
"Anonymous", and why one of its seven threads is signed "Admin", a string
anybody could type. Here a `before insert` trigger overwrites `author_id` from
`auth.uid()` and `author_name` from the poster's own profile row. `test:rls`
asserts both directly by trying to post as somebody else.

**`author_name` is denormalised onto every row, for two reasons.**
`profiles_select` is `own OR is_public OR staff`, so a reader must be able to
see who wrote a thread whether or not the author opted into the directory —
and widening that policy to make it work would leak the names of people who
chose not to be listed. Copying the name at write time is narrower: posting
reveals your name because you posted, not because a policy changed. It is also
a snapshot on purpose, so renaming yourself does not rewrite what everyone saw
you say.

**Rate limits are policy predicates, not application code** — 5 threads/hour,
30 replies/hour, 10 posts/hour, 20 messages/minute, 20 reports/hour. A limit in
an action is advice; this one holds for anything holding a token.

Which produced the one real trap here. Written as a subquery counting the same
table the policy guards, Postgres refuses outright with **"infinite recursion
detected in policy"** — evaluating the policy needs a select, which needs the
policy. Each count now lives in a `security definer` function in `private`,
which reads with RLS bypassed and never re-enters. Those functions count only
the caller's own rows and return an integer.

**Hiding, never deleting.** `hidden_at` / `hidden_by` / `hidden_reason` cover
both an author withdrawing and staff removing. The row survives either way: a
moderation decision that destroys its own evidence cannot be reviewed, and a
reported post that vanished would take the report with it. Hidden content stays
visible to its author — finding a post silently gone teaches nothing.

**Reports are invisible to the person reported.** `content_reports` selects on
`own OR staff`, so the reported author cannot see who objected or that anything
was filed. One report per person per item, by unique key, so three taps do not
read as three people. **Nothing auto-hides on a report count**, deliberately:
that is how a coordinated group silences a legitimate post.

**Announcements is staff-write only**, via `staff_only_write` checked inside the
insert policy. A room everyone can write to is a discussion; one labelled
"Announcements" that anyone can write to is a way to publish a false
announcement during the week people are choosing preferences.

**Chat is Supabase Realtime, and two things about it bit.** The socket
authenticates separately from the REST client — without
`realtime.setAuth(token)` before `subscribe()`, it connects as an anonymous
reader, `chat_messages_select` matches nothing, and **no message ever arrives
with no error anywhere**. And the sender must never depend on the socket: the
send action returns the stored row and the component appends it, keyed by id
against the socket's copy. The first version returned only an id, so with the
socket down a person watched their own message disappear while it was saved.

**Categories and Feed kinds carry a Koboyo mark**, in
`src/components/community/category-icon.tsx`. That is the icon policy's split
read correctly: these label *what a thing is*, the job the specialty marker
does beside a heading. They sit on the filter chips as well, but a chip is a
label for a taxonomy that happens to be clickable, not a toolbar action — the
mark identifies the category, not the act of filtering. The composers' buttons
and the reporting control still carry animated icons.

The choices follow the original's own emoji so a reader arriving from it
recognises the row: 💬 General, ❓ Q&A, 📚 Study, 🏠 Hospital, 📋 Merit,
⭐ Story, ⚠ Concern; ❓ Question, 🏥 Hospital review, 📚 Resource,
🏆 Result update. Story takes the compass rather than a second trophy, since
the trophy is already the Feed's result update.

Sized `h-3 w-auto` — one dimension, because Koboyo is hand-drawn with per-icon
viewBoxes. The differing widths are harmless in a wrapping row of chips, which
is the opposite of the navigation, where they made every label start at a
different x and drove the rails to the animated set instead. The same mark also
appears beside the composer's category hint, because a native `<option>` cannot
carry one and that is where the mapping becomes learnable.

`private.can_post()` is verified **and** carrying a display name. The second
half is not decoration: authorship is the entire safety model, and a post
attributed to an empty string is an anonymous post with extra steps.

### Filter changes must not read as a page load

Every filtered surface keeps its state in the URL, which makes applying a
filter a same-route navigation. Measured before touching anything, that was
**already a client transition** — the document survives, one navigation entry,
and React keeps the same DOM nodes rather than rebuilding. It still felt like a
reload, for two reasons that had nothing to do with the navigation type:

- **The scroll jumped to the top.** Next.js scrolls to the top on navigation by
  default. That is right for a different page and wrong for a dropdown beside
  the row you are reading, and it is most of what makes a filter feel like a
  reload.
- **The UI froze for the length of the server render.** Without a transition,
  React blocks the commit until the server component resolves — 1.5 s on a
  filtered read of the accreditation register — with no sign anything is
  happening.

`useFilterNav()` (`src/components/app/use-filter-nav.ts`) is the fix for both:
`router.push(href, { scroll: false })` inside `startTransition`, returning
`pending`. Every filter control goes through it. `<Link>`-based chips —
Discussion categories, Feed kinds, chat rooms, the Feed's facet clears — carry
`scroll={false}` for the same reason.

**Pagination is the deliberate exception** and keeps the default scroll:
arriving at page 4 still parked at the bottom of page 3 shows the reader the
end of a list whose start they have not seen. `go()` takes `{ scroll: true }`
for those.

**The pending state dims, it does not blank.** `FilterPending`
(`src/components/app/filter-pending.tsx`) drops the result area to 55% and sets
`aria-busy`, keeping the previous result readable — it is still the true answer
for the filter that produced it, and replacing it with a skeleton throws away
information *and* recreates the reload impression this exists to remove. Submit
buttons say "Updating…" and disable, so a second click cannot queue a second
navigation.

`<Reveal>` was suspected and is **not** a factor: because React preserves the
component instance across a same-route navigation, its `shown` state survives
and the entrance animation does not replay. Worth recording so it is not
re-investigated.

### Shortlist

`src/lib/shortlist.ts` and `src/components/portal/shortlist.tsx`. A star on
every hospital card and profile, a "My shortlist (N)" drawer, capped at 40.

**`localStorage` only, and that is the decision rather than the shortcut.** A
shortlist is a viewing preference, not evidence: nothing decides anything from
it and nobody else reads it. What it *would* be on a server is a record of which
hospitals a named candidate is circling during a live cycle — the same reasoning
that keeps `find-me` and the manual candidate in the browser.

**The store is generic.** An item is `{id, type, label, href, meta}`, so a page
opts in by rendering a star and the module never learns about hospitals. The
original's is built the same way and only its hospital pages use it; ours match
that rather than inventing new places to save from.

Three things that each bit or nearly did:

- **The star lives inside a card that is itself a `<Link>`**, so it calls
  `preventDefault` and `stopPropagation`. Without both, saving a hospital opens
  it — the most annoying bug this control can have.
- **State is read after mount, never during render.** `localStorage` does not
  exist on the server, so seeding from it directly fails hydration. The button
  is `disabled` until the store has been read rather than showing a confident
  "not saved" it is about to contradict, and the drawer's count renders only
  once `ready`.
- **A tab does not receive its own `storage` event.** Cross-tab sync needs
  `storage`; keeping the stars on *this* page in step with the drawer needs a
  custom event as well. Same pair as `find-me`.

### Staff-authored content: banners and Editorial

`notifications` and `editorial_posts`, both written by `is_staff()` —
super_admin or moderator. Deliberately **not** `can_post()`: this is not
community content, it speaks in the site's own voice, and a banner carries an
authority a forum post does not.

The point of both is that they take their content from a **table rather than a
file in the repo**. During a live round, the difference between "post an
announcement" and "ask the contractor for a redeploy" is the difference between
telling candidates something on the day and not telling them.

**A notification's link is constrained to an internal path by a check
constraint**, not only by the form — verified by trying it with the service
role, which is refused. A banner above every page is the most trusted surface in
the product, and the people reading it are being asked for verification details
elsewhere in the same week; an external link there is a phishing vector the
moment a staff account is compromised.

**Dismissals live in `localStorage`, keyed by notice id.** A row per user per
notice would be a new table, a new policy and a write on page load, to remember
that somebody clicked ✕. A new announcement reaches everybody because its id has
never been dismissed. Read after mount, and the banner renders `null` until then
— so nothing below it moves when it turns out to have been dismissed.

**Editorial bodies are parsed, never injected** (`src/lib/announce/render.ts`).
Two block types: a line starting `## ` is a heading, everything else is a
paragraph. Not Markdown and not HTML — a full Markdown renderer brings raw-HTML
passthrough and arbitrary link targets, which are ways to reach off this site
from a surface that speaks in its voice. Anything unrecognised renders as the
literal text the author typed, which is the safe failure; verified by putting a
`<script>` tag in a body and finding zero script elements in the article.

**Drafts are staff-only by policy**, so an author reads a piece on the real page
in its real typography before anybody else can. The original cannot do this at
all: its pieces are markup inside `editorial.html`, so writing one and
publishing one are the same act. Ours also get their own URL rather than the
original's hash-routing, so a piece somebody sends you opens on the piece.

**Support is a content page, not a payment integration.** The original has no
processor either — it explains the cost, gives bank and Raast details, and asks
people to claim through the access-request form, which already carries
`payment_reference` / `payment_declared` / `payment_verified`.

**The totals and all 185 supporters are carried across, hardcoded**, at the
owner's instruction. There is no feed behind them; they were read off the live
page on 2026-08-25 and the page says as much rather than implying a number that
updates itself.

**The payment details are two tabs, Bank transfer and Raast/QR, as the original
has them.** They are two ways of doing the same thing rather than two halves of
one instruction — somebody paying from a banking app scans and never reads the
number, somebody typing a transfer never looks at the code — so showing both at
once makes each reader skip half the panel.

The QR is generated **server-side** with `qrcode` into an SVG string. The value
never changes, so shipping an encoder to every browser would be paying for work
that can be done once; it also keeps the page free of a CDN script. Its holder
is `bg-white` **in both themes** and always will be: a QR is read by contrast,
and dark modules on a dark card scan for nobody.

Tab icons are `@hugeicons-animated`, not Koboyo — a tab is a control, and the
standing rule is that anything clickable animates. `role="tablist"` with
arrow-key movement, so it is a tab set rather than two buttons that look like
one.

`src/lib/support/supporters.ts` is a **server-only module, deliberately not a
file in `public/`** — 185 names served verbatim at a guessable URL is the exact
shape of the original's failure. Two values were cleaned **on the way in**, the
same rule `pool-directory.mjs` and `joining-status.mjs` follow, so that what was
never written cannot later leak:

- **Parentage stripped** from 143 of the 185. Every other surface here strips
  it, and a page that prints the amount beside the name is not the place to stop.
- **One entry withheld**: a supporter typed their **email address** into the
  name box and the original publishes it. Same class as the three candidates who
  typed a CNIC into the pool's name field. It renders as "Anonymous supporter",
  amount and date intact.

### Privacy and Terms

`/privacy` and `/terms`, linked from the landing footer. Both are **static and
reachable signed out** — a privacy policy behind a login is not a privacy
policy — so they live outside the `(app)` group with their own shell
(`src/components/legal/legal-page.tsx`) and read nothing from the database.

They are marketing surfaces, so they use the `brand-*` family and stay light in
both themes. That rule is stronger here than on the landing page: a legal
document should look identical to every reader, and to the same reader on two
different days.

**Every claim on the privacy page is checkable in this repository** — the tier
split, the private avatar bucket, the EXIF strip, the exact list of
`localStorage` keys, and the fact that no analytics dependency exists in
`package.json`. Nothing is aspirational, because a policy describing an
intention rather than a behaviour is what eventually becomes a lie. It says
plainly that the merit list is a public record we republish rather than a file
collected from anybody, and names the three things stripped at ingest —
parentage, CNIC-as-name, and the joining export's employment columns.

The terms lead with the disclaimer rather than burying it: not affiliated with
PHF, PRP, PMDC, CPSP or any hospital, every figure derived rather than issued,
and where this site and PHF disagree, PHF is right.

**`updated` is a printed string, not a computed date.** A page that silently
claims to have been revised today, every day, is worse than one with an honest
date — the date is the reader's only handle on which version they agreed to.

**The titles wrap, and that is correct.** Neither fits one line inside a 896px
reading measure, and the measure is worth more than the line count on a document
people read top to bottom. They carry `text-balance` so the wrap is even rather
than an orphan.

**The footer's "Official Disclaimer" points at `/terms#disclaimer`, not
`/terms`.** It used to be `#trust`, a landing-only anchor that did nothing once
the footer began appearing on the legal pages; repointing it at `/terms` fixed
the dead link but left two labels on one destination. `LegalCallout` takes an
`id`, so the terms page's opening callout is the thing that link actually names.

Two things the owner should confirm before this goes anywhere near production:
the contact address (currently the one already published on the original site)
and the governing-law clause naming Pakistan.

**The contents rail** (`src/components/legal/legal-toc.tsx`) reads its entries
**out of the rendered DOM**, not from a prop. The headings are already on the
page, and a second copy beside the prose is the one that goes stale. The cost is
that it is absent from the server HTML, which is acceptable only because it is
`position: fixed` and moves nothing when it appears; the small-screen fallback
is a *closed* `<details>`, so populating its list after mount shifts nothing
either.

Three things it gets right that are easy to get wrong:

- **Closed, the labels are `max-w-0 overflow-hidden`, not merely invisible.**
  Laid out and hidden, they made the nav 280px wide at every viewport, putting
  an invisible click target over the right-hand third of the prose below about
  1400px. Closed it is 65px, so it fits the gutter; it starts at `xl`, where the
  gap to the text is 115px.
- **Active section is computed from scroll position, not
  `IntersectionObserver`.** The question is "which heading did I last pass",
  which an observer does not answer. It also **clamps to the last entry at the
  bottom of the document**: the final section is often too short to ever reach
  the offset, so without the clamp the rail reports the section above it for the
  whole tail of the page — measured on the terms page, heading 10 sitting at
  191px with the rail saying 09.
- **Labels open on focus as well as hover**, and every entry is a real anchor.
  Hover-only would make it a pointer cue, the same reason `useActionIcon` wires
  `onFocus` beside `onMouseEnter`.
- **It fades out as the footer arrives**, over the first 180px of footer, and
  stops taking pointer events once it is invisible. The rail belongs to the
  article; left at full strength it hangs beside a block of links it has nothing
  to do with, still claiming a section is current after the reader has left the
  prose. The trigger is the footer's own position rather than a scroll
  percentage, because the two pages are different lengths. Hovering or focusing
  it overrides the fade, so a control somebody has reached for is never fading
  under their pointer. **No CSS transition on that opacity** — the value is
  already driven frame by frame from scroll, so a transition only chases it and
  reads as the rail lagging the page.

### Dropdowns, and the selection colour

**`Select` is a real listbox now** (`src/components/app/select.tsx`), not a
styled native `<select>`. The old note in `field.tsx` argued a custom one would
be worse at keyboard, type-ahead and the mobile picker — so all three are
implemented rather than skipped. What that note missed is that the *trigger* was
never the problem: **the popup list is drawn by the operating system**, so it was
the one surface in the product that ignored the design entirely, down to a hard
blue highlight bar in the middle of a teal page.

**A real `<select>` is still rendered, hidden**, carrying `value`, `onChange`,
`name` and `disabled`. Choosing an option sets its value through the prototype
setter and dispatches a real `change` event, so React hands the call site's own
`onChange` a genuine `ChangeEvent<HTMLSelectElement>`. That is why **none of the
69 call sites changed** — and why form submission by `name` still works. Setting
`.value` directly does *not* work: React tracks the last value it wrote and
swallows the event as a no-op.

Three things that each cost a bug:

- **The button must come before the hidden select in the DOM.** Several call
  sites wrap the control in a `<label>` rather than using `htmlFor`, and an
  implicit label activates the *first* labelable descendant. With the select
  first, clicking "Specialty" focused something invisible and nothing opened.
  A `<button>` is labelable, so ordering it first restores the click; the
  select's option text stays out of the accessible name because it is
  `aria-hidden`.
- **The hidden select still needs an `id`.** The trigger takes the call site's
  `id`, which left the select with neither `id` nor `name` — flagged by the
  browser and invisible to autofill. It gets a derived one.
- **Options are chosen on `pointerdown`, not `click`.** The outside-close
  listener is also on `pointerdown`, so on a click the panel is gone before the
  click lands.

Type-ahead matters more here than anywhere: the specialty filter has 44 options
and the hospital filter 69, and typing "card" is how anyone actually uses those.
The buffer clears after a second of no typing, as a native select does.

**Text selection is tokenised** — `--selection-bg` / `--selection-fg` in
`globals.css`, per theme. Not a reuse of `--accent-quiet`, which is a 10% wash
sized to sit behind a badge and disappears as a highlight. `::selection` is not
inherited, so it is declared for both `::selection` and `*::selection` or a
selection spanning a child element reverts to the browser default halfway
through. The marketing pages keep their own via `selection:` utilities, which
are more specific and still win.

### Page copy is short, and the reasoning lives here instead

Standing instruction from the owner: **there is too much text on the app pages.**
Descriptions, "how this works" sections and methodology notes are more than a
candidate will read, and anything a normal user does not need should not be on
screen at all.

The distinction is **audience**. Most of what accumulated was written for a
reader who wants to know *why* a number is what it is — how a figure was
derived, where the port differs from the original, why a field was excluded,
what a rule prevents. That reasoning is worth keeping and is not being deleted:
it moves into the code comment above the thing it explains, into this file, and
into the devlog. It does not belong in a paragraph under a heading.

What stays on a page: one short sentence saying what it shows; anything a reader
must act on — a deadline, that this is not the official source, a figure that
means something other than the obvious; and the labels and units that make a
number readable.

**Text-by-purpose pages are excluded and were not touched**: `/app/guide`,
`/app/policy`, `/app/editorial`, `/app/support`, `/privacy` and `/terms`.
Trimming those removes the content rather than the packaging.

**Do not drop a factual correction while shortening.** Several notes exist
because the original site states something misleading — the Candidate Pool's
"applied to no programme" count, Jobs' frozen open/closed flag, Data Changes'
zero-is-not-a-score. The correction stays, in fewer words; only the explanation
of how it was reached comes out.

Measured across the 61 files touched: **4,620 on-screen words to 3,219, 30%
removed.**

Two sections went entirely, both engine internals with a better home:

- The portal Overview's **Detailed reference** — consent matching, queue
  sorting and the cascade's seven steps. `/app/guide` is where an explanation
  belongs; somebody opening the portal wants the merit list.
- `/app/profile`'s **Not built yet** reasons. The labels stay, so a reader
  arriving from the original sees the feature is known about rather than lost;
  the paragraph explaining why each is unbuilt was written for us.

### Loading, empty, and broken states

**`loading.tsx` skeletons.** One at `(app)/app/loading.tsx` covers every page
under `/app`, because nearly all of them are built from the same template —
eyebrow, display heading, standfirst, figure strip, content — so a single
placeholder matches closely enough that nothing jumps when the real page lands.
Routes whose shape genuinely differs (merit table and accreditation are tables,
Editorial is prose, an article has no figure strip) get their own alongside
`page.tsx`.

**A skeleton belongs only where there is nothing on screen yet.** Never on a
filter change: the previous result is still the true answer for the filter that
produced it, so swapping it for grey boxes discards information *and* recreates
the "it reloads the whole page" complaint. That case dims — `FilterPending`.
The two do not collide because `useFilterNav` wraps its navigation in
`startTransition`, and React keeps the old UI rather than falling back to the
Suspense boundary. Verified: filtering Accreditation shows zero `.skeleton`
nodes and holds scroll at 1200.

**The sweep is a composited `translateX` on an `::after`, not an animated
`background-position`** — a page can hold forty of these while a table loads.
It runs left to right, the direction the text it stands in for is read.
`--skeleton-sheen` is a per-theme token because one translucent white is
invisible on the light ground: light gets a dark wash, dark gets a light one.

**Reduced motion is now handled globally** in `globals.css`, which it was not
before. The skeleton keeps its shape and loses only the sweep — still a
placeholder, just a still one. Deliberately not a blanket `animation: none`:
that would also kill the icon animations, which already check the preference
themselves in `use-icon-animation.ts`.

**The landing page has its own pending cue**, `LinkPending`
(`src/components/landing/link-pending.tsx`), on every link that enters the app.
The app's skeletons cannot help there: they belong to the destination segment
and only appear once Next.js has begun rendering it, which from `/` means
loading a whole other layout first. Measured on Slow 3G, a What's Inside card
left the reader on the landing page for **8.7 seconds** before the URL changed.

It paints two things -- a bar across the top of the viewport, and a local cue on
the control. The top bar is **portaled into `document.body`** because
`useLinkStatus` only reports inside its own `<Link>`, so a page-wide cue has to
be painted by whichever link is actually pending. Only one can be
mid-navigation, so they cannot stack.

**A hard load of an app page still shows no skeleton**, and that is structural:
`loading.tsx` is a Suspense fallback below the layout, and `(app)/layout.tsx`
awaits session, profile, roles, avatar and notices before returning markup, so
nothing can stream until it resolves. Fixing it means moving the shell's
non-gating reads behind their own boundaries, keeping only the auth gate
blocking. Not yet done.

**`NavPending` uses `useLinkStatus`**, which only reports while its own `<Link>`
is navigating — so it fires on a real route change and never on a filter change.
The bar eases toward the far edge and stops at 92%: the app does not know how
long a read will take, and a bar that reaches 100% and sits there is a promise
it cannot keep.

**Three error surfaces.** `(app)/app/not-found.tsx` renders inside the shell and
deliberately does not guess why — `notFound()` covers a mistyped slug, a hidden
thread and an unpublished draft, and telling them apart would confirm the hidden
thing exists. `(app)/app/error.tsx` shows the **digest**, never `error.message`:
a thrown Postgres error names tables, columns and policies. `global-error.tsx`
replaces the whole document, so it carries its own `<html>`/`<body>` and inline
literal colours — the one place a hardcoded hex is correct, because no
stylesheet is guaranteed to have loaded, and a plain `<a>` rather than
`next/link` because the router is what failed.

**Note for testing:** a folder starting with `_` is a **private folder** in the
App Router and is not routable at all. An `__error-probe` route silently 404s.

### The account menu

`src/components/app/user-menu.tsx`, in the `(app)` header, beside the theme
toggle and the sign-out button.

**Theme and sign out are in the header, not in the menu — the owner's call, and
it reverses an earlier decision here.** They were folded into the dropdown on
the reasoning that everything answering "this is me and what can I change about
it" belongs together. That grouping is tidy and wrong for these two: switching
theme because the room got dark and signing out on a shared machine are both
things people reach for often and want in one tap, and a frequently-used control
should not be two gestures deep. The menu keeps what is genuinely *about the
account* — who you are, your profile, and the staff surfaces.

The original's header does the same with one "My Profile" link beside logout.

**Below `sm` the theme control moves into the menu, and only there.** That is
arithmetic beating the argument above rather than a change of mind: the control
is three 32px buttons, and with the nav trigger, the logo, the account menu and
sign out already in the row there is no space for it on a phone. Sign out keeps
its place with the label dropped to an icon, carrying `aria-label` — an
icon-only control with no accessible name is a button only sighted pointer users
can identify. The header is still the primary home for both; the menu row is
`sm:hidden` and the header's is `hidden sm:block`.

**The menu panel is anchored differently on either side of `sm`.** The trigger is
not the last thing in the header — sign out sits to its right — so a 288px panel
hung off its right edge starts about 120px off the left of a 390px screen. Below
`sm` it is a `fixed` panel inset from both viewport edges, capped at
`calc(100dvh-5.5rem)` and scrollable, so a staff account with five links plus the
theme row cannot run off a short screen. `position: sticky` on the header does
not create a containing block for `fixed`, so the viewport really is the
reference.

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
- **An HTML entity in JSX text eats the leading space of its run.** Write
  `<strong>No interference.</strong> Do not overload the site` where the same
  text run later contains `&rsquo;`, and the compiler emits
  `interference.</strong>Do not` — the space is gone in the server HTML, not
  just after hydration. The identical markup one list item away, without an
  entity anywhere in the run, keeps its space, which is what makes it so easy
  to stare past. Found on two bullets of the new Terms page and then on 24
  other files that were already shipping. **Use the literal character — `’`,
  `“`, `”` — never the entity.** All 67 occurrences in `src/` were converted;
  a sweep of 18 rendered pages for `</strong>`, `</em>`, `</a>` or `</span>`
  followed immediately by a letter now returns only decorative bullet dots.
- **`overflow-x: hidden` breaks `position: sticky`; `overflow-x: clip` does
  not.** `hidden` creates a scroll container, and a sticky descendant then
  sticks to that container rather than to the viewport. The landing page needed
  a horizontal clip to trim a decorative glow that bled 40px past a full-width
  card, and `hidden` would have silently killed both scrollytelling sections.
  Reach for `clip` whenever the goal is "stop this bleeding sideways" rather
  than "make this scroll".
- **Do not scrub a video from scroll position.** Seeking an H.264 file lands on
  the nearest keyframe rather than the requested frame, so a smooth scroll
  produces jumps whose size is a property of the encode; writing `currentTime`
  every frame also keeps the decoder mid-seek, which turns each jump into a
  stall. No amount of damping fixes either. Let the video play and drive the
  captions from scroll instead.
- **Never use a semantic colour token on a marketing surface.** `--accent`
  flips to `brand-mint` under a dark colour scheme, and the landing page is
  theme-invariant cream. `text-accent` on the hero therefore painted the
  emphasis word mint on cream for any reader in dark mode -- while the sketch
  underline beneath it is a data URI with `#0D9488` baked in, so the word and
  its own underline were different colours. Use `brand-teal`. The rule already
  existed in the design-tokens section; this is where it had drifted.
- **A page title is one line, and the accent span is inline.** The display
  headline used to be a plain first line plus a `block text-accent` second line
  inside a `max-w-[16ch]` clamp. The clamp forced the *intended* lines to wrap
  again, orphaning two words onto a third line on some titles and not others.
  No clamp, accent inline, `text-balance` so a genuine wrap on a phone splits
  evenly. `/app/merit` is the only headline in a column rather than across the
  page, so its figures panel is sized to leave the title room.
- **JSX strips a trailing whitespace run containing a newline.** `Closing
  merits,\n<span>2020-2026</span>` renders as `Closing merits,2020-2026`. Any
  text immediately followed by an element on the next line needs an explicit
  `{" "}`. This is the same class of bug as the HTML-entity one below and it
  hit all 33 titles at once.
- **Every render of user-written text needs `break-words`.** `whitespace-pre-wrap`
  preserves an unbroken run rather than wrapping it, so one long token widens
  its container past the page — measured at **17,665px** inside a 1,190px column
  from a single review body, taking the whole document with it. It applies to
  bodies, titles, summaries, reporter notes and **display names**, on Discussion,
  the Feed, the moderation queue and hospital reviews. Chat already had it; the
  rest did not.
- **A control that appears on interaction needs its slot reserved.** The review
  form's "clear" button was appended once a star was picked, which widened its
  row and shoved the stars leftward at the moment of the click — and left the
  unrated rows lining their stars up differently from the rated ones. It has a
  fixed-width slot on every row now, empty when there is nothing to clear. Same
  class of bug as the quote strip's unreserved height.
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
