-- Row Level Security. Postgres denies access to an RLS-enabled table with no
-- matching policy, so enabling it everywhere gives deny-by-default: a table
-- added later without policies is inaccessible, not public.
--
-- Every auth.uid() / helper call is wrapped in a scalar subquery. Postgres
-- evaluates the bare call once per row; the subquery form is evaluated once and
-- cached. On merit_entries that is the difference between a scan and a timeout.

alter table public.user_roles      enable row level security;
alter table public.candidates      enable row level security;
alter table public.candidate_links enable row level security;
alter table public.merit_entries   enable row level security;
alter table public.access_requests enable row level security;
alter table public.profiles        enable row level security;
alter table public.access_logs     enable row level security;
alter table public.screenshot_logs enable row level security;

-- Apply RLS to the table owner too. service_role has BYPASSRLS and is
-- unaffected, which is intended.
alter table public.user_roles      force row level security;
alter table public.candidates      force row level security;
alter table public.candidate_links force row level security;
alter table public.merit_entries   force row level security;
alter table public.access_requests force row level security;
alter table public.profiles        force row level security;
alter table public.access_logs     force row level security;
alter table public.screenshot_logs force row level security;

-- user_roles: read own or super_admin. No insert/update/delete policy at all —
-- this is the hole that let anyone self-grant admin in the original project.
create policy user_roles_select_self on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_super_admin()));

-- candidates (tier 2): the linked candidate, or staff. No write policy.
create policy candidates_select_own on public.candidates for select to authenticated
  using (
    (select private.is_staff())
    or (
      (select private.is_verified())
      and exists (
        select 1 from public.candidate_links l
        where l.user_id = (select auth.uid())
          and l.applicant_id = candidates.applicant_id
      )
    )
  );

create policy candidate_links_select_own on public.candidate_links for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));

-- merit_entries (tier 1): any signed-in user, mirroring exactly what the
-- original showed. Sign-in required so scraping is attributable and the
-- invite-only model holds. Writes are service-role only.
create policy merit_entries_select_authenticated on public.merit_entries for select to authenticated
  using (true);

-- access_requests: no anonymous insert policy — submission goes through a
-- server route that verifies the applicant id against the private candidates
-- table first. A user may read only the row matching their own email.
create policy access_requests_select_own on public.access_requests for select to authenticated
  using (
    (select private.is_staff())
    or lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );

create policy access_requests_update_staff on public.access_requests for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

create policy access_requests_delete_super_admin on public.access_requests for delete to authenticated
  using ((select private.is_super_admin()));

create policy profiles_select on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or is_public or (select private.is_staff()));

create policy profiles_insert_self on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Both clauses required: `using` alone would let a user rewrite user_id and
-- hand their row to someone else.
create policy profiles_update_self on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy profiles_delete_self on public.profiles for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.is_super_admin()));

-- Sign-in failures have no authenticated user, so insert must be open to anon.
-- Deliberately no select policy for anyone but staff.
create policy access_logs_insert_any on public.access_logs for insert to anon, authenticated
  with check (true);
create policy access_logs_select_staff on public.access_logs for select to authenticated
  using ((select private.is_staff()));

create policy screenshot_logs_insert_self on public.screenshot_logs for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy screenshot_logs_select_staff on public.screenshot_logs for select to authenticated
  using ((select private.is_staff()));

-- RLS filters rows; grants control table access. Both are required, and grants
-- are the coarser of the two. No write grant on candidates, merit_entries,
-- user_roles or candidate_links — service-role only. Identity columns need no
-- sequence grant, unlike serial.
--
-- NOTE: these GRANTs are superseded by 20260809115447, which first revokes the
-- permissive defaults Supabase applies to every new public table. Left in place
-- so the migration history replays faithfully.
grant usage on schema public to anon, authenticated;

grant select on public.merit_entries   to authenticated;
grant select on public.candidates      to authenticated;
grant select on public.candidate_links to authenticated;
grant select on public.user_roles      to authenticated;
grant select, update on public.access_requests to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant insert on public.access_logs to anon, authenticated;
grant select on public.access_logs to authenticated;
grant insert, select on public.screenshot_logs to authenticated;
