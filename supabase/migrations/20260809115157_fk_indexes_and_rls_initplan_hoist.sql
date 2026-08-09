-- Foreign key columns get no automatic index in Postgres. Without one, every
-- delete or update of the referenced auth.users row scans the whole child
-- table. screenshot_logs.user_id was covered; these two were missed.
create index if not exists access_requests_reviewed_by_idx
  on public.access_requests (reviewed_by);

create index if not exists user_roles_granted_by_idx
  on public.user_roles (granted_by);

-- Hoist the entire caller-email expression into a single scalar subquery.
-- The previous form already produced an InitPlan (evaluated once, not per row),
-- but the subselect sat inside lower(coalesce(...)) where the database linter
-- could not see it, so it reported a per-row re-evaluation. Restructuring makes
-- the single evaluation explicit to both the planner and the linter.
drop policy if exists access_requests_select_own on public.access_requests;

create policy access_requests_select_own
  on public.access_requests for select
  to authenticated
  using (
    (select private.is_staff())
    or lower(email) = (select lower(coalesce(auth.jwt() ->> 'email', '')))
  );
