-- Extended to carry programme and quota as well.
--
-- The filter dropdowns had the same defect as the round selector: round 1 alone
-- holds 1,053 entries, so fetching them to collect distinct programmes and
-- quotas hit the same 1000-row cap and could silently drop whichever values
-- happened to sort last.
drop view if exists public.merit_list_rounds;

create view public.merit_list_rounds
with (security_invoker = on) as
  select distinct induction, round, program, quota
  from public.merit_entries;

revoke all on public.merit_list_rounds from anon, authenticated;
grant select on public.merit_list_rounds to authenticated;
