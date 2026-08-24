-- Batch-loads the allocation pool, for the same reason `apply_portal_inputs`
-- exists: one round trip per applicant does not finish, and PostgREST cannot
-- express "insert these rows, each with different values" any more cheaply than
-- an upsert — which is what this is, done in a single statement.
--
-- Unlike `apply_portal_inputs` this one DOES insert. That is the point: the
-- pool is every applicant, including the 2,021 who never reached a merit list
-- and therefore have no `candidates` row.
create or replace function public.apply_applicant_pool(
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
      marks_total    numeric,
      preferences    jsonb,
      certificates   jsonb,
      profile_status smallint
    )
  ),
  written as (
    insert into public.applicants as a
      (induction, applicant_id, marks_total, preferences, certificates, profile_status)
    select
      p_induction, i.applicant_id, i.marks_total, i.preferences, i.certificates, i.profile_status
    from input i
    on conflict (induction, applicant_id) do update
      set marks_total    = excluded.marks_total,
          preferences    = excluded.preferences,
          certificates   = excluded.certificates,
          profile_status = excluded.profile_status,
          updated_at     = now()
    returning a.id
  )
  select count(*) into v_written from written;

  return v_written;
end;
$$;

comment on function public.apply_applicant_pool(integer, jsonb) is
  'Batch-upserts the allocation pool. Service role only — never granted to anon or authenticated.';

revoke all on function public.apply_applicant_pool(integer, jsonb) from anon, authenticated, public;
