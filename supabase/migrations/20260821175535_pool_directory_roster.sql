-- The Candidate Pool roster.
--
-- The original portal's Candidate Pool tab is a searchable table of every
-- applicant, and clicking a row opens their marks, preference list and
-- certificates. This table is what backs a faithful port of it.
--
-- ## Why this is a new table and not columns on `public.applicants`
--
-- `applicants` is read by the allocation engine with the **service role**, and
-- what makes that safe is not care in the calling code but that the table
-- cannot identify anyone: it carries no name and no contact details, so a bug
-- in the engine is a wrong number rather than a leak. Adding a name column
-- there would destroy that property for every existing caller at once.
--
-- So the identity lives here instead, behind a policy, and the engine keeps
-- reading an identity-free table. Two tables, two different guarantees.
--
-- ## What is deliberately NOT here
--
--   CNIC, email address, contact number, father's name.
--
-- Not because they are unavailable — they are in `candidates` — but because the
-- original's own modal does not show them. A faithful port has no use for them,
-- and Tier 2 keeps them.
--
-- ## The decision this table represents
--
-- Of the 3,474 applicants in a cycle, the gazette has published a name for the
-- 1,453 who reached a merit list. Exposing the other 2,021, and exposing full
-- preference lists to any verified user rather than only to the candidate
-- themselves, is a widening of the tier split that the project owner authorised
-- explicitly. It is gated on `private.is_verified()` — a stronger gate than the
-- original's, which was an invite-only email-and-PIN scheme already compromised
-- by the historic leak.
--
-- The failure this project exists to undo was three JSON files served at public
-- URLs with no authentication at all. That is a different thing from a roster
-- behind a row-level policy, and the distinction is the whole reason this table
-- may exist.
create table public.pool_directory (
  id bigint generated always as identity primary key,
  induction integer not null,
  applicant_id bigint not null,

  name_full text,
  pmdc_no text,
  marks_total numeric,
  profile_status smallint,

  -- Which programmes the portal records the candidate as having applied to.
  -- Distinct from the preference list: the original's stats bar counts this,
  -- and 100 applicants have it empty while only one filed no preferences.
  applied_in jsonb not null default '{}'::jsonb,

  -- The nine-cell breakdown the original prints: degree, houseJob, experience,
  -- research, position, hardAreas, matric, fsc, attempts, mdcat.
  components jsonb not null default '{}'::jsonb,

  preferences jsonb not null default '[]'::jsonb,

  -- Full certificate records — discipline name, session, status, percentage —
  -- as opposed to the (program_id, discipline_id, marks) triples the engine
  -- needs in `applicants`.
  certificates jsonb not null default '[]'::jsonb,

  -- Amendment history, which drives the original's "✎ amended" badge.
  revisions jsonb not null default '{}'::jsonb,

  updated_at timestamptz not null default now(),

  -- Applicant ids are reissued every cycle and the same number is a different
  -- person each time, so the identity is the pair.
  unique (induction, applicant_id)
);

comment on table public.pool_directory is
  'Candidate Pool roster: name, PMDC, marks, components, preferences, certificates and amendments for every applicant in a cycle. Readable by verified users only. Deliberately carries no CNIC, email, contact number or father''s name — those stay in candidates, tier 2.';

create index pool_directory_induction_idx on public.pool_directory (induction);
create index pool_directory_marks_idx on public.pool_directory (induction, marks_total desc);

alter table public.pool_directory enable row level security;

-- Revoke first. Supabase's default privileges have already granted ALL on every
-- new public table to anon and authenticated, so an additive grant is a no-op
-- and RLS would end up as the only control.
revoke all on public.pool_directory from anon, authenticated;

grant select on public.pool_directory to authenticated;

-- Verified identity, not merely authentication. `to authenticated using (true)`
-- would be authentication without authorization, and if anonymous sign-ins are
-- ever enabled an anonymous user holds the `authenticated` role.
create policy pool_directory_select_verified on public.pool_directory
  for select to authenticated
  using ((select private.is_verified()));

-- No insert, update or delete policy for either client role. The ingest
-- pipeline writes this with the service role.
