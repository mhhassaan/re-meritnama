-- The PHF portal reissues applicant IDs every induction cycle. Verified against
-- the real archives: inductions 20 and 21 share 144 applicant IDs, and in every
-- one of those cases the two records belong to DIFFERENT people (0% name match,
-- checked on parsed data with the extraction validated first).
--
-- So `applicant_id` alone cannot be a primary key. It identifies a record only
-- as the pair (induction, applicant_id). Loading a second induction under the
-- old schema would collide on the primary key, or silently overwrite a
-- different person's record.
--
-- The original site avoided this by only ever holding one induction's
-- per-candidate data. This product wants history across cycles, so the key has
-- to model reality instead.

-- The RLS policy joins candidate_links on applicant_id, so it must be dropped
-- before that column can move, and rebuilt against the new shape afterwards.
drop policy if exists candidates_select_own on public.candidates;

-- ---- candidates: surrogate primary key, real identity as a unique key -------

alter table public.candidates
  add column id bigint generated always as identity;

alter table public.candidate_links
  drop constraint candidate_links_applicant_id_fkey;

alter table public.candidates
  drop constraint candidates_pkey;

alter table public.candidates
  add constraint candidates_pkey primary key (id);

-- UNIQUE rather than PRIMARY KEY: the same applicant number legitimately recurs
-- in a later cycle, belonging to someone else.
alter table public.candidates
  add constraint candidates_induction_applicant_key unique (induction, applicant_id);

-- ---- candidate_links: point at the surrogate key ----------------------------
-- Keyed on (user_id, candidate_id) rather than user_id alone: a candidate who
-- misses a seat reapplies next cycle with a NEW applicant id, and both records
-- are legitimately theirs. A single-column key would force the new cycle to
-- overwrite the old link.

alter table public.candidate_links
  add column candidate_id bigint;

update public.candidate_links l
set candidate_id = c.id
from public.candidates c
where c.applicant_id = l.applicant_id;

delete from public.candidate_links where candidate_id is null;

alter table public.candidate_links
  alter column candidate_id set not null;

alter table public.candidate_links drop constraint candidate_links_pkey;
alter table public.candidate_links drop constraint candidate_links_applicant_id_key;
alter table public.candidate_links drop column applicant_id;

alter table public.candidate_links
  add constraint candidate_links_pkey primary key (user_id, candidate_id);

alter table public.candidate_links
  add constraint candidate_links_candidate_id_fkey
  foreign key (candidate_id) references public.candidates (id) on delete cascade;

-- One account per candidate record: two people must not claim the same record.
alter table public.candidate_links
  add constraint candidate_links_candidate_id_key unique (candidate_id);

create index candidate_links_candidate_id_idx on public.candidate_links (candidate_id);

-- ---- rebuild the policy against the new shape -------------------------------
-- Now a straight join on the surrogate key, which is also cheaper than the
-- previous applicant_id comparison.
create policy candidates_select_own on public.candidates for select to authenticated
  using (
    (select private.is_staff())
    or (
      (select private.is_verified())
      and exists (
        select 1 from public.candidate_links l
        where l.user_id = (select auth.uid())
          and l.candidate_id = candidates.id
      )
    )
  );

-- merit_entries already includes induction in its unique constraint; this index
-- supports "show me this candidate's rows for this cycle".
create index if not exists merit_entries_induction_applicant_idx
  on public.merit_entries (induction, applicant_id);
