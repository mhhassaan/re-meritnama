-- The allocation cascade has to read EVERY candidate's preferences, marks and
-- verification status. No signed-in user may read those for anyone but
-- themselves, so the engine cannot run as the calling user.
--
-- The answer is not to hand the engine a service-role client pointed at
-- `candidates`. That table holds CNIC, email, phone and father's name, and a
-- bug in the engine or in whatever renders its output would then be a contact
-- data leak rather than a wrong number.
--
-- Instead the tier split is applied again, at read time, by a view that
-- contains only the fields the algorithm actually uses. Nothing sensitive is
-- reachable through it even with the service role, because nothing sensitive is
-- in it. Names for display come from `merit_entries`, which is Tier 1 and
-- already published.
create view public.cascade_inputs
with (security_invoker = true)
as
select
  c.induction,
  c.applicant_id,
  c.marks_total,
  c.preferences,
  c.certificates,
  c.profile_status
from public.candidates c;

comment on view public.cascade_inputs is
  'Allocation-engine projection of candidates: marks, preferences, certificates and verification status only. No name, CNIC, email, phone or father''s name. Read with the service role by the portal server action; security_invoker keeps it under RLS for everyone else.';

-- `security_invoker` means this view is governed by `candidates`' own policies
-- for any normal caller, so a signed-in user reading it still sees only their
-- own row. The service role bypasses RLS as always — which is exactly why the
-- column list above matters, and why it must never be widened.
revoke all on public.cascade_inputs from anon, authenticated;
grant select on public.cascade_inputs to authenticated;
