-- `to authenticated using (true)` is authentication without authorization.
-- Two problems with it here:
--
-- 1. If anonymous sign-ins are ever enabled on this project, anonymous users
--    carry the `authenticated` Postgres role and would pass this check —
--    handing out name, PMDC number and marks for every candidate to anyone who
--    calls the sign-in endpoint. That is precisely the exposure this rebuild
--    exists to fix.
--
-- 2. It was inconsistent with the product's own identity model. Access is
--    invite-only, and control of the address on the candidate record is what
--    proves a claim. An account that has never confirmed its email has proven
--    nothing, so it should not see gazette data either.
--
-- private.is_verified() reads auth.users.email_confirmed_at, so anonymous users
-- (which have no email) fail it inherently — the guard holds whether or not
-- anonymous sign-ins are switched on later.
drop policy if exists merit_entries_select_authenticated on public.merit_entries;

create policy merit_entries_select_verified
  on public.merit_entries for select
  to authenticated
  using ((select private.is_verified()));
