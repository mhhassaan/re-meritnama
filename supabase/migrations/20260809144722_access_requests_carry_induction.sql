-- An access request records an applicant id, which is only meaningful paired
-- with an induction. Without the cycle, approval could not tell which
-- candidate record to link once more than one induction is loaded — the same
-- ambiguity just fixed on `candidates`, one level up.
alter table public.access_requests
  add column induction integer not null default 21;

-- A candidate may legitimately request access again in a later cycle, so the
-- unique key is the pair, not the email alone.
alter table public.access_requests
  drop constraint access_requests_email_key;

alter table public.access_requests
  add constraint access_requests_email_induction_key unique (email, induction);

-- The select policy still matches on lower(email); this keeps that lookup
-- indexed now that email alone is no longer unique.
create index if not exists access_requests_email_induction_idx
  on public.access_requests (lower(email), induction);
