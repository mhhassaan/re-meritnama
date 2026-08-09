-- Supabase's default privileges grant ALL (select, insert, update, delete,
-- truncate, references, trigger) on every newly created public table to both
-- `anon` and `authenticated`. Adding explicit GRANTs on top of that is a no-op:
-- the permissive grant is already in place.
--
-- That leaves RLS as the ONLY control. Defence in depth needs both, so that a
-- future permissive policy, or an accidental `disable row level security`,
-- does not immediately expose or destroy data. Least privilege belongs at the
-- grant layer first.
--
-- Strip everything, then re-grant exactly what each role needs.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Stop the same thing happening to tables created later.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

grant usage on schema public to anon, authenticated;

-- Tier 1: gazette-equivalent, readable by any signed-in user. Read only —
-- the pipeline writes it with the service role.
grant select on public.merit_entries to authenticated;

-- Tier 2: RLS narrows this to the caller's own row; the grant keeps it read-only
-- so even a policy mistake cannot let a candidate rewrite their own CNIC.
grant select on public.candidates      to authenticated;
grant select on public.candidate_links to authenticated;
grant select on public.user_roles      to authenticated;

-- Users may read their own request and staff may action it; nobody inserts
-- directly — submission goes through a server route that verifies first.
grant select, update on public.access_requests to authenticated;

grant select, insert, update, delete on public.profiles to authenticated;

-- Failed sign-ins are anonymous, so anon must be able to append. Neither role
-- may read: staff read via the select policy, which still needs the grant.
grant insert on public.access_logs to anon, authenticated;
grant select on public.access_logs to authenticated;

grant insert, select on public.screenshot_logs to authenticated;
