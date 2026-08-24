# Not implemented

Everything the original MeritNama has that this rebuild does not, and why.

Three reasons appear over and over, so they are abbreviated in the tables:

| Tag | Means |
| :-- | :-- |
| **scope** | Not built yet. No blocker — it needs doing. |
| **data** | The data is not in our database, and getting it there needs an ingest or a source we do not hold. |
| **decision** | Building it would change the security posture or publish something nobody has published. Needs the owner, not a developer. |
| **declined** | Deliberately not ported. The reason is given. |

Last checked against the deployed site on **2026-08-24**, signed in.

---

## 1. Whole pages and tabs

### Historical Data app (`app.html`)

| Feature | Status | Notes |
| :-- | :-- | :-- |
| Start Here, Merit Table, My Prediction, Calculator, Compare, Previous Merit Lists | **built** | — |
| **Jobs** | scope | `#tab-jobs` — "Current Job Openings. Browse current medical job openings. Filter by role, organization, location, or status — deadlines and availability update live." Needs a jobs table and someone to maintain it. |
| **Policy** | scope | `#tab-policy` — "Scoring Policy History: how the PRP merit formula evolved across induction cycles and why normalization is essential." We already hold `policy_by_induction.json` and do this normalisation in `src/lib/compare` — this is mostly presentation over data we have. |
| **Guide** | scope | `#tab-guide` — "How to Use MeritNama. A complete reference for every term, metric, and feature in the app." Pure content. |

### Induction Portal (`simulation.html`)

| Tab | Status | Notes |
| :-- | :-- | :-- |
| Overview, Candidate Pool, Merit List, Joining Status, Config, Where Merit Falls, Schedule, Hospitals, Training Seats, Competition | **built** | — |
| **Consent What-If** | scope | "Compare normal seat allocation with a rerun where one candidate does not consent. The report shows the released seat, who moves in, and the subsequent candidate list changes." Hidden on the live site in Merit List Mode. **The engine already exists** — `runCascade` plus the Simulate Next Round action do this for a whole round; this is the single-candidate version of it. Closest to shippable of anything on this page. |
| **Profiles** | scope + decision | "Community Profiles — browse registered members who have shared their profile." Our `profiles` table and its `own OR is_public OR staff` policy already support it. The live site notes **66 members are private**, which is the model we would follow. The decision is what a directory entry shows. |
| **Chat** | decision | "Live Chat — choose a room, see who is online, mention @username or @everyone." Rooms: General, Announcements, Preference Strategy and more. **The first feature where one user writes what another reads**, so it needs moderation, reporting, blocking, rate limits and a retention policy designed before any of it is built. |
| **Data Changes** | data | `candidatesChanges.html` — "Candidate Data Changes". We hold `candidates_changes.json` and `induction21_revisions.json` in `ingest/`, and the ✎ amended badge already reads revisions, so this is largely presentation. |
| **Accreditation** | data | `accreditation.html` — "CPSP Accredited Programs. Official FCPS accreditation data from CPSP." Live: **5,587 accredited programs, 537 hospitals, 92 cities, 92 specialities**. This is a CPSP dataset we do not have; it is not derivable from the seat matrix. |

### Standalone pages

| Page | Status | Notes |
| :-- | :-- | :-- |
| `hospital.html` | **built** | Ported as `/app/portal/hospitals/[slug]`. |
| `candidate.html` (My Profile) | **partly built** | See §3. |
| **`reviews.html` — Discussion** | decision | Persistent Q&A forum: searchable threads and hospital reviews. Same user-writes-content problem as Chat. |
| **`community.html` — Community Feed** | decision | Questions, hospital reviews, resources and result updates, filtered to your specialty. Same problem. |
| **`editorial.html` — Editorial** | scope | "In-depth analysis, policy commentary, and data-driven insights." Content, plus somewhere to author it. |
| **`donate.html` — Support** | scope | "Keep MeritNama Running." Payments are the owner's, not ours — see §5. |
| **`admin.html`** | n/a | We have our own `/admin`. The original's is not a porting target. |

---

## 2. Features inside pages that are built

| Where | Feature | Status | Notes |
| :-- | :-- | :-- | :-- |
| Candidate Pool | **Download pool as PDF** | declined | No bulk export. Search, filter and paging all run in the database so no request returns the whole pool; a PDF of all 3,474 undoes that in one click. |
| Merit List | **Tidbits with father's names** | declined | The original prints each name with their father's name. That is Tier 2 and published nowhere. The applicant id disambiguates instead. |
| Joining Status | **"Send Happy Residency Email"** | declined | An outbound mail tool over the project's verified sender is the shape of the open relay in the original's Firestore rules. Nothing candidate-facing needs it. |
| Joining Status | **"Likely wasted" bucket** | data | The live site offers it as a stat and a filter. Nothing in the export distinguishes it from "not joined yet", and its own counter reports 0 while all five deadlines have passed. Each deadline is printed on the row instead. |
| Config | **Merit formula: "MS/MD Marks Adjusted"** | data | A formula there is a definition — base field, fields to sum, adjustments — stored in the owner's Firestore. We hold the name, not the definition. |
| Config | **Candidate revision (Amendment 1/2/3)** | scope | Re-derives every mark by subtracting a per-field delta over house job, position, MDCAT and degree. Amendments are ingested and shown on a record; the engines read a precomputed total, so applying one means recomputing the pool. |
| Hospital profile | **Training Reviews** | decision | Resident-written reviews, rated overall and per aspect. Needs a table, a write path and moderation. |
| Portal header | **Inbox badge, share button, language globe, background picker** | scope | Small chrome. The background picker offers page-wide visual themes. |
| Portal header | **Notification and editorial banners** | scope | Admin-authored announcements pinned above the page. |

---

## 3. My Profile (`candidate.html`)

Built: identity (display name, aspiring specialty, aspiring hospital), discoverability, the linked Induction Portal record, and the profile-strength checklist.

| Feature | Status | Notes |
| :-- | :-- | :-- |
| **Profile photo** | scope | `profiles.avatar_path` exists and nothing writes it. Needs a storage bucket and its own access policy. The account menu shows an initial rather than a broken image. |
| **Page animation** | declined | Twelve full-page background effects — Pulse, Drift, Aurora, Particles, Vortex, Shimmer, Cascade, Breathe, Prism, Wave, Nebula — tinted from the avatar's colour. Decorative, and at odds with the design system. |
| **Message the admin / inbox** | decision | Pick a "data-backed responder", supply an **applicant id**, and the system drafts a reply from that dataset for an admin to approve. One responder reads grievance verification records — a lookup surface over one of the three files in the historic leak. |
| **Invite Members** | declined | Two invites per account, generating a shareable **PIN**. That is the credential model this rebuild exists to replace: identity is proven by delivery to an address already on the record, never by a code someone can forward. Needs redesigning, not porting. |
| **My Contributions** | scope | Ties a donation to an account. Depends on Support (§5). |
| **Community & Mentorship block** | decision | Links to sub-forums, feed, "Request a Chat", "Become a Mentor", "Find a Mentor", anonymous Q&A and hospital reviews. Every destination is §1's community work. |
| **Trust signals row** | scope | "Unverified context · Public profile · No contribution linked · Photo added". Two of the four depend on features above. |

---

## 4. Deliberate differences in things that ARE built

Not missing — different on purpose, and each is stated on the page it affects.

- **Candidate Pool "applied to no programme"** reads 87, the live site 100. Its counter checks FCPS, MS and MD only, so the 13 who applied to MDS alone are counted as having applied to nothing.
- **Joining Status "seats with nobody"** reads 66, the live site 67.
- **Joining dates.** The export is `DD/MM/YYYY` and the live site parses it as month-first: it prints "Apr 6" for a 4 June joining and a literal `Invalid Date` for the 256 of 1,082 rows whose day is above 12. Ours reads the components textually.
- **Schedule times.** The source carries no offset; the live site renders them in the viewer's zone. Ours are Pakistan wall-clock, labelled PKT.
- **Names.** The portal writes parentage into the name field on all 3,474 records — `D/O`, `S/O`, `Bint` — and three candidates typed their CNIC there. The gazette prints none of it. Both are stripped, and the three CNIC names are withheld.
- **Hospital seat table columns** are the programmes a hospital actually trains, not a hardcoded FCPS/MS/MD triple.
- **Where Merit Falls and Seat Allocation** are ours, not the original's, and sit after Config so the portal's own five appear in its order.

---

## 5. Blocked on the owner

Not developer work. Listed so they are not mistaken for scope.

- **Support / donations.** Payments, the account they land in, and any receipting.
- **The CPSP accreditation dataset.** 5,587 programs; we do not have the source.
- **Father's names.** Needed for nothing currently built, and deliberately absent.
- **Anything touching DNS, production billing, or the live site's Firebase project.**

---

## 6. Suggested order

1. **Consent What-If** — the engine exists; this is a narrower entry point into it.
2. **Policy** and **Guide** — content over data we already hold.
3. **Profiles directory** — one read policy, and the table is ready.
4. **Data Changes** — ingest exists in `ingest/`.
5. **Photo upload** — a storage bucket and one policy.
6. **Chat, Discussion, Community Feed** — one project, with moderation designed first.

~~Competition~~ — built. No new data (`loadPool` + `loadSeats`, both already
cached), no new policy.
