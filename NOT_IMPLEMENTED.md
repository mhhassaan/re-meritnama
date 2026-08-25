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
| Start Here, Merit Table, My Prediction, Calculator, Compare, Previous Merit Lists, Policy, Guide, Jobs | **built** | — |

### Induction Portal (`simulation.html`)

| Tab | Status | Notes |
| :-- | :-- | :-- |
| Overview, Candidate Pool, Merit List, Joining Status, Config, Where Merit Falls, Schedule, Hospitals, Training Seats, Competition, Consent What-If, Profiles, Data Changes, Accreditation, Chat | **built** | — |

### Standalone pages

| Page | Status | Notes |
| :-- | :-- | :-- |
| `hospital.html` | **built** | Ported as `/app/portal/hospitals/[slug]`. |
| `candidate.html` (My Profile) | **partly built** | See §3. |
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
| **Page animation** | declined | Twelve full-page background effects — Pulse, Drift, Aurora, Particles, Vortex, Shimmer, Cascade, Breathe, Prism, Wave, Nebula — tinted from the avatar's colour. Decorative, and at odds with the design system. |
| **Message the admin / inbox** | decision | Pick a "data-backed responder", supply an **applicant id**, and the system drafts a reply from that dataset for an admin to approve. One responder reads grievance verification records — a lookup surface over one of the three files in the historic leak. |
| **Invite Members** | declined | Two invites per account, generating a shareable **PIN**. That is the credential model this rebuild exists to replace: identity is proven by delivery to an address already on the record, never by a code someone can forward. Needs redesigning, not porting. |
| **My Contributions** | scope | Ties a donation to an account. Depends on Support (§5). |
| **Mentorship** | decision | "Request a Chat", "Become a Mentor", "Find a Mentor". The forum, feed and hospital reviews the rest of this block links to are now built; mentorship is a matching problem with its own consent questions and is not. |
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
- **Moderating the community surfaces.** The queue at `/app/admin/reports` is built and you hold `super_admin`, but somebody has to read it. Nothing hides itself on a report count, deliberately, so an unread queue means an unmoderated forum.
- **A current jobs feed.** `public/data/jobs.json` was scraped on 11 July 2026 and every deadline in it has passed. The live board's 153 postings live in the owner's Firestore, which is out of scope; a refreshed snapshot or an export of that collection would make the Jobs page current with no code change.
- **Father's names.** Needed for nothing currently built, and deliberately absent.
- **Anything touching DNS, production billing, or the live site's Firebase project.**

---

## 6. Suggested order

Nothing on the original's feature list is outstanding. What remains is
operational rather than scope — see §5.

~~Chat, Discussion, Community Feed~~ — built as one project, with the
moderation substrate first. Authorship comes from a database trigger reading
the session, so nobody can post under another name (the original's form has a
free-text name field, which is why its live forum is almost entirely
"Anonymous" and one thread is signed "Admin"). Rate limits are predicates
inside the insert policies. Reports are invisible to the person reported, one
per person per item, and **nothing auto-hides on a count** — a person decides
every case at `/app/admin/reports`. Hiding never deletes.

~~Photo upload~~ — built. Private bucket, writes scoped to the uploader's own
folder, and reads of anybody else's photo only through a server-minted signed
URL. It needed **four** policies rather than one: `upsert` reads the row it may
replace, so with no select policy every upload failed. The select is scoped to
the caller's own folder, which keeps the enumeration property intact. The
discoverability copy on `/app/profile` now names the photo — changed before the
feature shipped, and safe to change because no avatar existed yet.

~~Jobs~~ — built, against the 75-posting snapshot in `public/data/jobs.json`.
This one **is** genuinely data-limited, unlike Accreditation: the deployed site
shows 153 because its Jobs tab reads the owner's Firestore, which the snapshot
only seeds, and that project is out of scope. Every deadline in the snapshot has
passed, so the page reports 0 open and says so at the top. Status is computed
from the deadline on every render rather than read from the source's frozen
`isOpen` flag — the flag is why the official board currently shows 149 of 153
expired postings as open. A fresher file needs no code change.

**Outstanding for this page:** a refreshed `jobs.json`, or an export of the
Firestore collection. Owner's call — see §5.

~~Accreditation~~ — built, and it was never blocked on data. This list had it
tagged **data** on the reasoning that 5,587 CPSP programmes are a dataset we do
not hold; `public/data/cpsp_accreditation.json` had been in the repo the whole
time. No table, no policy, no ingest. Three inconsistencies in the register are
left uncorrected and stated on the page rather than silently fixed: `Unit-I`
versus `Unit-1`, 58 byte-identical duplicate rows plus institutions listed under
several spellings, and the unexplained `F.A.` / `P.A.` / `T.A.` codes.

~~Data Changes~~ — built. Three things are withheld from the source diff: CNIC
values (397 records, and the original renders none of them either), the old and
new name strings (400 records), and the individual preference seats (21,796
deltas). Preference **counts** are kept, because 113 of the 622 changed records
changed nothing else and would otherwise be missing from the page. The page also
corrects the original's central claim: a zero in the applicant file means *no
record*, so of the 440 total-marks movements only **57** are a mark actually
being revised.

~~Profiles~~ — built, and it needed **no** new policy after all: `profiles_select`
was already `own OR is_public OR staff`. Cards carry three fields, because
`/app/profile` already promises exactly that to anyone who opts in. The
original's merit band, inducted status and programme tags are all derived
from marks or preferences, which that promise rules out.

~~Policy~~ and ~~Guide~~ — built. Both read data already loaded by other
surfaces; no new source, no new policy.

~~Competition~~ — built. No new data (`loadPool` + `loadSeats`, both already
cached), no new policy.

~~Consent What-If~~ — built. **Correction to this list's earlier entry**: it
does not reuse the cascade. The original runs it on the blank-slate placement
engine — the same one behind Seat Allocation — not on `runCascade`. Two full
placement runs per request (baseline, then the pool minus one applicant), so
it is closer in cost to Seat Allocation than to a narrow diff.
