-- MeritNama core schema. Two-tier candidate model:
--   merit_entries  Tier 1 — gazette-equivalent, readable by any signed-in user
--   candidates     Tier 2 — CNIC/email/phone/father's name, owner + staff only
-- The split is produced at WRITE time by the ingest pipeline, not filtered at
-- read time; the original site shipped a file containing everything and relied
-- on the UI not to render the private fields.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.app_role as enum ('super_admin', 'moderator', 'editorial', 'analyst');

-- No user-facing write policy anywhere: granting a role is service-role only.
create table public.user_roles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       public.app_role not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id)
);

-- SECURITY DEFINER so a policy reading user_roles does not recurse into its own
-- policy. search_path pinned to '' so a caller cannot shadow `public` and have
-- these resolve to a table they control.
create or replace function private.current_role_name()
returns public.app_role language sql stable security definer set search_path = ''
as $$ select role from public.user_roles where user_id = (select auth.uid()); $$;

create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((select role in ('super_admin','moderator')
                   from public.user_roles where user_id = (select auth.uid())), false);
$$;

create or replace function private.is_super_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((select role = 'super_admin'
                   from public.user_roles where user_id = (select auth.uid())), false);
$$;

-- Email confirmation is the real proof of identity here: credentials are only
-- ever delivered to the address already on the candidate record. Read from
-- auth.users rather than the JWT so it cannot be stale.
create or replace function private.is_verified()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from auth.users
                 where id = (select auth.uid()) and email_confirmed_at is not null);
$$;

revoke execute on function private.current_role_name() from public, anon, authenticated;
revoke execute on function private.is_staff()          from public, anon, authenticated;
revoke execute on function private.is_super_admin()    from public, anon, authenticated;
revoke execute on function private.is_verified()       from public, anon, authenticated;

-- Tier 2 — private
create table public.candidates (
  applicant_id   bigint primary key,
  name_full      text not null,
  pmdc_no        text,
  cnic           text,
  email_id       text,
  contact_number text,
  father_name    text,
  marks_total    numeric(6,3),
  applied_in     jsonb not null default '{}'::jsonb,
  preferences    jsonb not null default '[]'::jsonb,
  induction      integer not null default 21,
  updated_at     timestamptz not null default now()
);
create index candidates_email_idx on public.candidates (lower(email_id));

-- Server-written only; a client-writable link would let anyone point at any record.
create table public.candidate_links (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  applicant_id bigint not null unique references public.candidates (applicant_id) on delete cascade,
  linked_at    timestamptz not null default now(),
  linked_by    text not null default 'system'
);

-- Tier 1 — gazette-equivalent. PMDC included deliberately: the original site
-- exposed it and made it searchable in the merit list.
create table public.merit_entries (
  id               bigint generated always as identity primary key,
  induction        integer not null default 21,
  round            integer not null,
  applicant_id     bigint not null,
  name_full        text not null,
  pmdc_no          text,
  marks_total      numeric(6,3),
  effective_mark   numeric(6,3),
  cert_bonus       numeric(6,3),
  program          text not null,
  specialty        text not null,
  hospital         text not null,
  quota            text not null,
  preference_no    integer,
  consent_status   text,
  placement_status text,
  row_no           integer,
  created_at       timestamptz not null default now(),
  unique (induction, round, applicant_id, program, specialty, hospital)
);
create index merit_entries_lookup_idx on public.merit_entries (induction, round, specialty, hospital);
create index merit_entries_applicant_idx on public.merit_entries (applicant_id);
create index merit_entries_marks_idx on public.merit_entries (induction, round, marks_total desc);
create index merit_entries_search_idx on public.merit_entries
  using gin (to_tsvector('simple',
    coalesce(name_full,'') || ' ' || coalesce(applicant_id::text,'') || ' ' || coalesce(pmdc_no,'')));

create table public.access_requests (
  id                 bigint generated always as identity primary key,
  email              text not null unique,
  applicant_id       bigint,
  name_full          text,
  message            text,
  status             text not null default 'pending' check (status in ('pending','approved','rejected')),
  payment_declared   boolean not null default false,
  payment_amount_pkr numeric(10,2),
  payment_reference  text,
  payment_verified   boolean not null default false,
  proof_object_path  text,
  reviewed_by        uuid references auth.users (id),
  reviewed_at        timestamptz,
  created_at         timestamptz not null default now()
);
-- Must match the policy expression lower(email) or every check is a seq scan.
create index access_requests_email_lower_idx on public.access_requests (lower(email));

create table public.profiles (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  display_name   text,
  avatar_path    text,
  specialty_goal text,
  hospital_goal  text,
  is_public      boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index profiles_public_idx on public.profiles (user_id) where is_public;

-- Audit: write your own event, never read the log.
create table public.access_logs (
  id         bigint generated always as identity primary key,
  email      text,
  success    boolean not null,
  ip         text,
  user_agent text,
  page       text,
  created_at timestamptz not null default now()
);
create index access_logs_created_idx on public.access_logs (created_at desc);

create table public.screenshot_logs (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users (id) on delete set null,
  trace_id   text,
  page       text,
  created_at timestamptz not null default now()
);
-- FK columns get no automatic index; without one, deletes on auth.users scan this.
create index screenshot_logs_user_idx on public.screenshot_logs (user_id);

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;

create trigger candidates_touch before update on public.candidates
  for each row execute function private.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();
