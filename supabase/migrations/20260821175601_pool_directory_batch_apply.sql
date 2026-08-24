-- Batch-loads the Candidate Pool roster, for the same reason
-- `apply_applicant_pool` exists: one round trip per applicant does not finish
-- inside the ingest's timeout, and PostgREST cannot express "insert these rows,
-- each with different values" any more cheaply than a single upsert statement.
create or replace function public.apply_pool_directory(
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
      applicant_id   bigint,
      name_full      text,
      pmdc_no        text,
      marks_total    numeric,
      profile_status smallint,
      applied_in     jsonb,
      components     jsonb,
      preferences    jsonb,
      certificates   jsonb,
      revisions      jsonb
    )
  ),
  written as (
    insert into public.pool_directory as d
      (induction, applicant_id, name_full, pmdc_no, marks_total, profile_status,
       applied_in, components, preferences, certificates, revisions)
    select
      p_induction, i.applicant_id, i.name_full, i.pmdc_no, i.marks_total, i.profile_status,
      coalesce(i.applied_in, '{}'::jsonb),
      coalesce(i.components, '{}'::jsonb),
      coalesce(i.preferences, '[]'::jsonb),
      coalesce(i.certificates, '[]'::jsonb),
      coalesce(i.revisions, '{}'::jsonb)
    from input i
    on conflict (induction, applicant_id) do update
      set name_full      = excluded.name_full,
          pmdc_no        = excluded.pmdc_no,
          marks_total    = excluded.marks_total,
          profile_status = excluded.profile_status,
          applied_in     = excluded.applied_in,
          components     = excluded.components,
          preferences    = excluded.preferences,
          certificates   = excluded.certificates,
          revisions      = excluded.revisions,
          updated_at     = now()
    returning d.id
  )
  select count(*) into v_written from written;

  return v_written;
end;
$$;

comment on function public.apply_pool_directory(integer, jsonb) is
  'Batch-upserts the Candidate Pool roster. Service role only — never granted to anon or authenticated.';

revoke all on function public.apply_pool_directory(integer, jsonb) from anon, authenticated, public;
