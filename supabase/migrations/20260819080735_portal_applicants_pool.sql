-- The allocation pool.
--
-- `candidates` holds only the people who reached a merit list — 1,453 of the
-- cycle's 3,474 applicants. The other 2,021 applied and never placed, and they
-- are exactly the competition: running an allocation without them understates
-- how contested every seat is, and every predicted placement comes out
-- optimistic. A simulation that is systematically wrong in the direction people
-- want to believe is worse than no simulation.
--
-- So the pool gets its own table, and the tier split is applied to it at write
-- time rather than trusted to a read. It carries what the algorithm needs and
-- nothing else:
--
--   NOT here: CNIC, email, contact number, father's name.
--   NOT here: name. `merit_entries` already publishes the name of anyone who
--             placed, and the 2,021 who did not have never been published by
--             anyone. Storing their names would put this project's copy ahead
--             of the gazette, which is the failure the two-tier model exists
--             to prevent.
--
-- The result is a table that says "applicant 12345 applied for these seats and
-- scored this much" and cannot say who applicant 12345 is.
create table public.applicants (
  id bigint generated always as identity primary key,
  induction integer not null,
  applicant_id bigint not null,
  marks_total numeric,
  preferences jsonb not null default '[]'::jsonb,
  certificates jsonb not null default '[]'::jsonb,
  profile_status smallint,
  updated_at timestamptz not null default now(),

  -- Applicant ids are reissued every cycle and the same number is a different
  -- person each time, so the identity is the pair.
  unique (induction, applicant_id)
);

comment on table public.applicants is
  'The full allocation pool: preferences, marks and verification status for every applicant in a cycle. Deliberately carries no name and no contact details — it exists so the seat-allocation engine can model real competition without this project holding identities the gazette never published.';

create index applicants_induction_idx on public.applicants (induction);

alter table public.applicants enable row level security;

-- Revoke first: Supabase's default privileges have already granted ALL on this
-- table to anon and authenticated, so an additive grant would be a no-op and
-- RLS would be the only control.
revoke all on public.applicants from anon, authenticated;

-- No select grant and no select policy for either client role.
--
-- This is not a table anyone reads directly. 3,474 preference lists is the
-- shape of the original's leak — it shipped exactly this to every visitor — and
-- there is no product surface that needs the raw rows. The engine reads it
-- server-side with the service role and returns aggregates and placements; a
-- caller who wants a preference list gets their own from `candidates`, under
-- the policy that has always governed it.
--
-- The ingest pipeline writes it with the service role.
