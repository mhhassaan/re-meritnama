-- Candidate Data Changes: what the portal altered between two snapshots of the
-- applicant file.
--
-- The original diffs `old-induction21_candidates.json` against
-- `induction21_candidates.json` in the browser -- two 78 MB files carrying
-- CNIC, email and phone for every applicant, downloaded to render a table of
-- marks. The diff itself is already computed and published as
-- `candidates_changes.json`; this table holds the part of it that is safe to
-- keep, and the ingest script reads the source field by field so the rest
-- cannot arrive by accident.
--
-- ## What is here
--
-- One row per (candidate, field, programme) that moved. Values are numeric,
-- because every field worth showing is a mark, a count or a boolean.
--
-- ## What is deliberately absent
--
-- `cnic` -- 397 of the 622 changed records have one, and it is a national
-- identity number. The original does not render CNIC changes either (the word
-- appears nowhere on its page), so withholding them matches its behaviour
-- rather than diverging from it. The values are simply never read.
--
-- The old and new values of `nameFull` -- 400 records. The original prints
-- both, with parentage. Names in this source carry a father's name on
-- essentially every row, and three applicants typed their CNIC into the name
-- box, so a "previous name" column is a free-text field already shown to
-- contain identity numbers. The *fact* that the name record was filled in is
-- kept, as `field = 'name'` with no values; the strings are not.
--
-- Individual preference seats. The source lists 19,587 additions, 1,420
-- removals and 788 edits, up to 357 on one candidate — a large payload, and in
-- aggregate a second copy of the cycle's preference data. The **counts** are
-- kept per programme, because 113 of the 622 changed records changed nothing
-- else and would otherwise be missing from the page altogether. The seats
-- themselves are already readable per candidate on the Candidate Pool.
--
-- ## Readable by verified users
--
-- Same gate as the Candidate Pool roster and Joining Status. The rows describe
-- corrections to marks already published per candidate in `pool_directory`,
-- and carry no contact detail of any kind.
create table public.data_changes (
  id bigint generated always as identity primary key,
  induction integer not null,
  applicant_id bigint not null,

  -- 'marksTotal' | 'degree' | 'houseJob' | 'mdcat' | 'position' | 'experience'
  -- | 'programMarks' | 'appliedIn' | 'name' | 'record'
  -- | 'prefAdded' | 'prefRemoved' | 'prefEdited' | 'prefCount'
  --
  -- The four `pref*` fields carry a count in `new_value`, never a seat.
  field text not null,

  -- Programme code for 'programMarks', 'appliedIn' and the 'pref*' counts;
  -- empty string otherwise, so the unique key needs no expression index.
  program text not null default '',

  old_value numeric,
  new_value numeric,

  -- How to read the movement, because most of these are not what they look
  -- like. Of 440 total-marks changes, 358 are 0 to a real mark and 25 are a
  -- real mark to 0 -- records being populated and blanked, not merit moving.
  -- Only 57 are a revision between two real values. The original labels all
  -- 440 "Your total went up by X points".
  --   'appeared' | 'vanished' | 'revised' | 'added'
  kind text not null,

  updated_at timestamptz not null default now(),

  unique (induction, applicant_id, field, program)
);

comment on table public.data_changes is
  'Per-field diff between two snapshots of the applicant file. Readable by verified users. Carries no CNIC, no name strings, and no preference lists.';

create index data_changes_induction_idx on public.data_changes (induction);
create index data_changes_applicant_idx on public.data_changes (induction, applicant_id);
create index data_changes_field_idx on public.data_changes (induction, field);

-- The run's own summary, so the page can state the pool sizes the diff was
-- taken over rather than inferring them from the rows it kept.
create table public.data_change_runs (
  induction integer primary key,
  generated_at text not null,
  old_source text,
  new_source text,
  old_count integer not null,
  new_count integer not null,
  added integer not null,
  removed integer not null,
  changed integer not null,
  total_updates integer not null,
  updated_at timestamptz not null default now()
);

comment on table public.data_change_runs is
  'Summary of the snapshot comparison behind public.data_changes.';

alter table public.data_changes enable row level security;
alter table public.data_change_runs enable row level security;

-- Revoke first: Supabase default privileges have already granted ALL on both
-- tables to anon and authenticated, so an additive grant would be a no-op.
revoke all on public.data_changes from anon, authenticated;
revoke all on public.data_change_runs from anon, authenticated;

grant select on public.data_changes to authenticated;
grant select on public.data_change_runs to authenticated;

create policy data_changes_select_verified on public.data_changes
  for select to authenticated
  using ((select private.is_verified()));

create policy data_change_runs_select_verified on public.data_change_runs
  for select to authenticated
  using ((select private.is_verified()));

-- No write policy for either client role. The ingest pipeline uses the service
-- role.
create or replace function public.apply_data_changes(
  p_induction integer,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_written integer;
begin
  with input as (
    select *
    from jsonb_to_recordset(p_rows) as x(
      applicant_id bigint,
      field        text,
      program      text,
      old_value    numeric,
      new_value    numeric,
      kind         text
    )
  ),
  written as (
    insert into public.data_changes as d
      (induction, applicant_id, field, program, old_value, new_value, kind)
    select
      p_induction, i.applicant_id, i.field, coalesce(i.program, ''),
      i.old_value, i.new_value, i.kind
    from input i
    on conflict (induction, applicant_id, field, program) do update
      set old_value  = excluded.old_value,
          new_value  = excluded.new_value,
          kind       = excluded.kind,
          updated_at = now()
    returning d.id
  )
  select count(*) into v_written from written;

  return v_written;
end;
$fn$;

comment on function public.apply_data_changes(integer, jsonb) is
  'Batch-upserts the snapshot diff. Service role only -- never granted to anon or authenticated.';

revoke all on function public.apply_data_changes(integer, jsonb) from anon, authenticated, public;

create or replace function public.apply_data_change_run(
  p_induction integer,
  p_run jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.data_change_runs as r
    (induction, generated_at, old_source, new_source, old_count, new_count,
     added, removed, changed, total_updates)
  select
    p_induction,
    x.generated_at, x.old_source, x.new_source, x.old_count, x.new_count,
    x.added, x.removed, x.changed, x.total_updates
  from jsonb_to_record(p_run) as x(
    generated_at  text,
    old_source    text,
    new_source    text,
    old_count     integer,
    new_count     integer,
    added         integer,
    removed       integer,
    changed       integer,
    total_updates integer
  )
  on conflict (induction) do update
    set generated_at  = excluded.generated_at,
        old_source    = excluded.old_source,
        new_source    = excluded.new_source,
        old_count     = excluded.old_count,
        new_count     = excluded.new_count,
        added         = excluded.added,
        removed       = excluded.removed,
        changed       = excluded.changed,
        total_updates = excluded.total_updates,
        updated_at    = now();
end;
$fn$;

revoke all on function public.apply_data_change_run(integer, jsonb) from anon, authenticated, public;
