-- Joining Status: who actually reported to the seat they were allocated.
--
-- The last step of a cycle and the only one the merit list cannot answer.
-- Round 8 placed 1,208 people; 1,082 appear in the final seat-allocation export
-- and 1,077 of those have joined. The gap is what makes a seat genuinely free.
--
-- ## Columns are exactly what the original's card shows
--
-- The source export also carries `cnic`, `emailId`, `contactNumber`, and the
-- employment record collected at joining — `empType`, `empProvince`, `bps`,
-- `dept`, `desg`. None of it is here. The portal's own Joining Status card
-- shows the applicant id, the name, the mark, the preference number, the seat
-- and the joining date, and that is the whole list.
--
-- Employment details are worth calling out separately: they are not in the
-- original leak and not in any published gazette, so ingesting them would put
-- this project ahead of both. If a later feature needs them they get their own
-- table and their own decision.
--
-- ## Readable by verified users, like the roster
--
-- Placements are already Tier 1 — `merit_entries` publishes who was allocated
-- each seat to every verified user. Whether that person then turned up is the
-- same category of fact about the same public allocation, so it carries the
-- same gate.
create table public.joining_status (
  id bigint generated always as identity primary key,
  induction integer not null,
  applicant_id bigint not null,

  name_full text,
  pmdc_no text,

  program text not null,
  specialty text not null,
  hospital text not null,
  institute text,
  quota text not null,

  marks numeric,
  preference_no integer,
  -- Capacity of the seat, as the export records it. The card prints the number
  -- of candidates against it.
  seats integer,

  -- 'Joined' or 'Pending', the export's own vocabulary.
  status text not null,

  -- Parsed from the export's DD/MM/YYYY, which is NOT what `new Date()` reads.
  -- See the ingest script: 256 of 1,082 rows have a day above 12.
  joined_on date,

  updated_at timestamptz not null default now(),

  -- One row per person: 1,082 rows, 1,082 distinct applicant ids. A candidate
  -- joins one seat or none.
  unique (induction, applicant_id)
);

comment on table public.joining_status is
  'Who reported to their allocated seat, from the final seat-allocation export. Readable by verified users. Carries no CNIC, email, contact number, or the employment record collected at joining.';

create index joining_status_induction_idx on public.joining_status (induction);
create index joining_status_seat_idx on public.joining_status (induction, program, specialty, hospital, quota);

alter table public.joining_status enable row level security;

-- Revoke first: Supabase's default privileges have already granted ALL on every
-- new public table to anon and authenticated, so an additive grant is a no-op.
revoke all on public.joining_status from anon, authenticated;

grant select on public.joining_status to authenticated;

create policy joining_status_select_verified on public.joining_status
  for select to authenticated
  using ((select private.is_verified()));

-- No write policy for either client role. The ingest pipeline uses the service
-- role.
create or replace function public.apply_joining_status(
  p_induction integer,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_written integer;
begin
  with input as (
    select *
    from jsonb_to_recordset(p_rows) as x(
      applicant_id  bigint,
      name_full     text,
      pmdc_no       text,
      program       text,
      specialty     text,
      hospital      text,
      institute     text,
      quota         text,
      marks         numeric,
      preference_no integer,
      seats         integer,
      status        text,
      joined_on     date
    )
  ),
  written as (
    insert into public.joining_status as j
      (induction, applicant_id, name_full, pmdc_no, program, specialty, hospital,
       institute, quota, marks, preference_no, seats, status, joined_on)
    select
      p_induction, i.applicant_id, i.name_full, i.pmdc_no, i.program, i.specialty,
      i.hospital, i.institute, i.quota, i.marks, i.preference_no, i.seats,
      i.status, i.joined_on
    from input i
    on conflict (induction, applicant_id) do update
      set name_full     = excluded.name_full,
          pmdc_no       = excluded.pmdc_no,
          program       = excluded.program,
          specialty     = excluded.specialty,
          hospital      = excluded.hospital,
          institute     = excluded.institute,
          quota         = excluded.quota,
          marks         = excluded.marks,
          preference_no = excluded.preference_no,
          seats         = excluded.seats,
          status        = excluded.status,
          joined_on     = excluded.joined_on,
          updated_at    = now()
    returning j.id
  )
  select count(*) into v_written from written;

  return v_written;
end;
$$;

comment on function public.apply_joining_status(integer, jsonb) is
  'Batch-upserts the joining export. Service role only — never granted to anon or authenticated.';

revoke all on function public.apply_joining_status(integer, jsonb) from anon, authenticated, public;
