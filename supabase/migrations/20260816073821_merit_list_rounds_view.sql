-- Distinct (induction, round) pairs, for the Previous Merit Lists selector.
--
-- Deriving this by fetching merit_entries and reducing in JavaScript does not
-- work: PostgREST caps a response at 1000 rows, and ordered by round the first
-- 1000 rows are all round 1 — so every cycle appeared to have exactly one
-- round. The distinct has to happen in the database.
--
-- `security_invoker = on` is the load-bearing part. Without it a view runs as
-- its owner and would bypass the RLS on merit_entries entirely, handing an
-- unverified caller the shape of the data. With it, the view is evaluated as
-- the caller and the base table's policies still apply.
create or replace view public.merit_list_rounds
with (security_invoker = on) as
  select distinct induction, round
  from public.merit_entries;

-- Default privileges grant ALL on new objects to anon and authenticated, so the
-- revoke comes first and the grant is narrow. Read-only, and never anon.
revoke all on public.merit_list_rounds from anon, authenticated;
grant select on public.merit_list_rounds to authenticated;
