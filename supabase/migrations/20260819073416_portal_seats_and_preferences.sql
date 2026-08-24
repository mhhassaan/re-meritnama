-- The Induction Portal needs three things the schema does not yet carry: seat
-- capacities, each candidate's ordered preference list, and their verification
-- outcome. This adds all three, and corrects a name that is actively
-- misleading.
--
-- `candidates.preferences` did NOT hold a preference list. The consent-round
-- ingest wrote one entry per round the candidate consented in, each carrying a
-- consent status and the preference number of the seat they consented to. That
-- is a consent history, and calling it `preferences` guarantees someone will
-- eventually feed it to the allocation engine, which expects the candidate's
-- full ordered list of every seat they applied for. Those are different facts
-- with different lengths and different meanings.

alter table public.candidates
  rename column preferences to consent_rounds;

comment on column public.candidates.consent_rounds is
  'One entry per round this candidate consented in: the seat, its preference number, and the consent status. NOT the preference list — see preferences.';

-- The real preference list: every seat the candidate applied for, in the order
-- they ranked them. This is what the cascade walks.
alter table public.candidates
  add column preferences jsonb not null default '[]'::jsonb;

comment on column public.candidates.preferences is
  'The candidate''s ordered preference list as submitted: every seat applied for, with preference_no, programme, quota, specialty, hospital and the discipline ids that decide certificate bonuses.';

-- Certificate marks, keyed by programme and discipline. The bonus applied to a
-- seat is the best one earned in a discipline that seat's preference names —
-- which is why the discipline ids have to travel with the preference.
alter table public.candidates
  add column certificates jsonb not null default '[]'::jsonb;

comment on column public.candidates.certificates is
  'Certificate marks by programme and discipline. A bonus only applies to a seat whose preference names the same discipline.';

-- Verification outcome. 1 = Accepted, 2 = Rejected, 11 = Pending, null = no
-- record. Only 1 keeps a seat in the cascade; null is unknown, not accepted.
alter table public.candidates
  add column profile_status smallint;

comment on column public.candidates.profile_status is
  'Verification outcome: 1 Accepted, 2 Rejected, 11 Pending, null no record. Amendment Process (type 132) overrides Verification Round 01 (type 131) at ingest time.';

-- Seats
--
-- Seat capacity per (induction, programme, quota, specialty, hospital). This
-- carries no personal data at all — it is the same class of fact as the merit
-- aggregates already in public/data, and every candidate needs to read all of
-- it to make sense of any allocation.
create table public.seats (
  id bigint generated always as identity primary key,
  induction integer not null,
  program text not null,
  quota text not null,
  specialty text not null,
  hospital text not null,
  institute text,
  seats integer not null check (seats >= 0),
  updated_at timestamptz not null default now(),

  -- The seat key is exactly these five. Any two rows agreeing on all of them
  -- are the same seat, and a duplicate would silently double its capacity.
  unique (induction, program, quota, specialty, hospital)
);

comment on table public.seats is
  'Training seat capacity per cycle and seat. No personal data; readable by any verified signed-in user.';

-- The cascade filters by cycle first and then walks seats, so the cycle leads.
create index seats_induction_program_idx
  on public.seats (induction, program, quota);

alter table public.seats enable row level security;

-- Revoke first, then grant narrowly. Supabase's default privileges have already
-- granted ALL on this table to anon and authenticated, so an additive grant
-- would be a no-op and RLS would be the only control.
revoke all on public.seats from anon, authenticated;
grant select on public.seats to authenticated;

-- Verified users only. `to authenticated using (true)` would be authentication
-- without authorization: if anonymous sign-ins are ever enabled, anonymous
-- users hold the authenticated role.
create policy seats_read_verified
  on public.seats
  for select
  to authenticated
  using ((select private.is_verified()));

-- No insert, update or delete policy: the ingest pipeline writes this with the
-- service role, and a table nobody can write is a table nobody can corrupt.
