-- Applies a batch of allocation inputs in one statement.
--
-- The ingest script was issuing one UPDATE per candidate — 3,474 network round
-- trips, which does not finish in a reasonable time. PostgREST cannot express
-- "update these rows, each with different values" in a single call, so the set
-- arrives as one jsonb document and is unpacked here.
--
-- Update only, never insert. `candidates` holds the people who appear in a
-- merit list; the source file has 3,474 applicants, most of whom never placed.
-- An upsert would create rows for all of them, and would do it with a partial
-- record and no contact details. A payload entry with no matching candidate is
-- simply skipped, and the returned count is what proves it — checking by effect
-- rather than by status, since a write that matched nothing still succeeds.
create or replace function public.apply_portal_inputs(
  p_induction integer,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  with input as (
    select *
    from jsonb_to_recordset(p_rows) as x(
      applicant_id   bigint,
      preferences    jsonb,
      certificates   jsonb,
      profile_status smallint
    )
  ),
  applied as (
    update public.candidates c
       set preferences    = i.preferences,
           certificates   = i.certificates,
           profile_status = i.profile_status,
           updated_at     = now()
      from input i
     where c.induction    = p_induction
       and c.applicant_id = i.applicant_id
    returning c.id
  )
  select count(*) into v_updated from applied;

  return v_updated;
end;
$$;

comment on function public.apply_portal_inputs(integer, jsonb) is
  'Batch-applies allocation inputs to existing candidate rows. Service role only — never granted to anon or authenticated.';

-- Default privileges have already been revoked for new functions in this
-- schema, but this one writes candidate data, so the revoke is written out
-- explicitly rather than relied upon.
revoke all on function public.apply_portal_inputs(integer, jsonb) from anon, authenticated, public;
