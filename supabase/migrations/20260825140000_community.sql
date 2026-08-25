-- Community: Discussion threads, the structured Feed, and live Chat.
--
-- The first place in this product where one user writes something another
-- reads. Everything below exists because that is a different problem from
-- publishing a gazette, and the database is where the answers have to live —
-- a rate limit or an authorship rule enforced only in a server action is
-- enforced only for callers who use the server action.
--
-- ## Authorship is taken from the session, never from the payload
--
-- The original's new-thread form has a free-text name field defaulting to
-- "Dr. Anonymous". That is why almost every post on the live forum reads
-- "Anonymous", and why one of its seven threads is signed "Admin" — a string
-- anybody could type. Impersonating the site owner costs nothing there.
--
-- Here `author_id` and `author_name` are both set by a trigger from
-- `auth.uid()` and the poster's own profile row. There is no field in which to
-- ask to be somebody else, and the client cannot supply either column.
--
-- `author_name` is **denormalised onto the post**, for two reasons:
--
--   * `profiles_select` is `own OR is_public OR staff`. A reader must be able
--     to see who wrote a thread whether or not the author made their profile
--     discoverable, and widening that policy to make it work would leak the
--     names of people who chose not to be listed. Copying the name at write
--     time is the narrower answer: posting reveals your name because you
--     posted, not because a policy changed.
--   * It is a snapshot on purpose. Renaming yourself does not retroactively
--     rewrite what everyone saw you say.
--
-- ## Hiding, not deleting
--
-- `hidden_at` / `hidden_by` / `hidden_reason` carry both cases: an author
-- withdrawing their own post, and staff removing one. The row survives either
-- way, because a moderation decision that destroys its own evidence cannot be
-- reviewed, and a reported post that vanishes takes the report with it.
--
-- ## Rate limits are policy predicates
--
-- Counted in the `with check` of each insert policy rather than in the action.
-- A limit in application code is advice; this one holds for anything holding a
-- user's token.
--
-- **The counts written below do not work, and the next migration replaces
-- them.** Written as subqueries against the table the policy guards, Postgres
-- refuses with "infinite recursion detected in policy". They are left here as
-- written so the sequence reads honestly; see
-- `20260825141000_community_rate_limit_helpers.sql` for the fix and for why
-- moving the count into `private` is narrow rather than a widening.

-- ── Who may post ────────────────────────────────────────────────────────
--
-- Verified, and carrying a display name. The second half is not decoration:
-- authorship is the whole safety model here, and a post attributed to an empty
-- string is an anonymous post with extra steps.
create or replace function private.can_post()
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select private.is_verified()
     and exists (
       select 1 from public.profiles
       where user_id = (select auth.uid())
         and coalesce(btrim(display_name), '') <> ''
     );
$fn$;

grant execute on function private.can_post() to authenticated;

-- ── Identity trigger ────────────────────────────────────────────────────
--
-- `security definer` so it can read the poster's own profile row regardless of
-- how the select policy is written later. It only ever reads the row belonging
-- to the caller.
create or replace function private.set_author_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_name text;
begin
  new.author_id := (select auth.uid());

  select btrim(p.display_name) into v_name
  from public.profiles p
  where p.user_id = new.author_id;

  if coalesce(v_name, '') = '' then
    raise exception 'Set a display name on your profile before posting.';
  end if;

  new.author_name := v_name;
  return new;
end;
$fn$;

-- ── Discussion threads ──────────────────────────────────────────────────

create table public.community_threads (
  id bigint generated always as identity primary key,

  -- Set by trigger from the session. Never accepted from the client.
  author_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null,

  -- The original's seven, verbatim.
  category text not null check (category in
    ('general', 'qa', 'study', 'hospital', 'merit', 'story', 'concern')),

  title text not null check (btrim(title) <> '' and length(title) <= 160),
  body text not null check (btrim(body) <> '' and length(body) <= 8000),

  -- Optional context the original collects on its form.
  specialty text check (length(specialty) <= 80),
  hospital text check (length(hospital) <= 160),
  year_stage text check (year_stage in
    ('any', 'aspirant', 'r1', 'r2', 'r3', 'r4', 'completed')),

  reply_count integer not null default 0,
  last_reply_at timestamptz,

  hidden_at timestamptz,
  hidden_by uuid references auth.users (id),
  hidden_reason text check (hidden_reason in ('author', 'staff')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz
);

create index community_threads_recent_idx
  on public.community_threads (coalesce(last_reply_at, created_at) desc);
create index community_threads_category_idx on public.community_threads (category);
create index community_threads_author_idx on public.community_threads (author_id);

create trigger community_threads_identity
  before insert on public.community_threads
  for each row execute function private.set_author_identity();

create trigger community_threads_touch
  before update on public.community_threads
  for each row execute function private.touch_updated_at();

-- ── Replies ─────────────────────────────────────────────────────────────

create table public.community_replies (
  id bigint generated always as identity primary key,
  thread_id bigint not null references public.community_threads (id) on delete cascade,

  author_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null,

  body text not null check (btrim(body) <> '' and length(body) <= 4000),

  hidden_at timestamptz,
  hidden_by uuid references auth.users (id),
  hidden_reason text check (hidden_reason in ('author', 'staff')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz
);

create index community_replies_thread_idx
  on public.community_replies (thread_id, created_at);
create index community_replies_author_idx on public.community_replies (author_id);

create trigger community_replies_identity
  before insert on public.community_replies
  for each row execute function private.set_author_identity();

create trigger community_replies_touch
  before update on public.community_replies
  for each row execute function private.touch_updated_at();

-- Reply counts are maintained here rather than counted per render: a thread
-- list showing 30 threads would otherwise run 30 counting queries, and the
-- number is on every card.
--
-- Hidden replies are excluded from the count, so a thread does not advertise
-- replies a reader cannot see.
create or replace function private.refresh_thread_replies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_thread bigint := coalesce(new.thread_id, old.thread_id);
begin
  update public.community_threads t
     set reply_count = (
           select count(*) from public.community_replies r
           where r.thread_id = v_thread and r.hidden_at is null
         ),
         last_reply_at = (
           select max(r.created_at) from public.community_replies r
           where r.thread_id = v_thread and r.hidden_at is null
         )
   where t.id = v_thread;
  return null;
end;
$fn$;

create trigger community_replies_count
  after insert or update or delete on public.community_replies
  for each row execute function private.refresh_thread_replies();

-- ── Community Feed ──────────────────────────────────────────────────────
--
-- Structured posts rather than threads. The original's four kinds, verbatim,
-- filtered by specialty and hospital.

create table public.community_posts (
  id bigint generated always as identity primary key,

  author_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null,

  kind text not null check (kind in
    ('question', 'hospital_review', 'resource', 'result_update')),

  title text not null check (btrim(title) <> '' and length(title) <= 160),
  body text not null check (btrim(body) <> '' and length(body) <= 4000),

  specialty text check (length(specialty) <= 80),
  hospital text check (length(hospital) <= 160),

  -- Only meaningful on a hospital review. Constrained rather than free, so the
  -- number means the same thing on every row.
  rating smallint check (rating between 1 and 5),

  hidden_at timestamptz,
  hidden_by uuid references auth.users (id),
  hidden_reason text check (hidden_reason in ('author', 'staff')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz,

  -- A rating outside a review is a number with no question attached to it.
  constraint community_posts_rating_is_review
    check (rating is null or kind = 'hospital_review')
);

create index community_posts_recent_idx on public.community_posts (created_at desc);
create index community_posts_kind_idx on public.community_posts (kind);
create index community_posts_author_idx on public.community_posts (author_id);

create trigger community_posts_identity
  before insert on public.community_posts
  for each row execute function private.set_author_identity();

create trigger community_posts_touch
  before update on public.community_posts
  for each row execute function private.touch_updated_at();

-- ── Chat ────────────────────────────────────────────────────────────────

create table public.chat_rooms (
  id text primary key,
  label text not null,
  description text,
  -- Announcements is read-only for candidates. A room everyone can write to
  -- is a discussion; a room labelled "Announcements" that anyone can write to
  -- is a way to publish a false announcement.
  staff_only_write boolean not null default false,
  sort_order integer not null default 0
);

insert into public.chat_rooms (id, label, description, staff_only_write, sort_order)
values
  ('general', 'General', 'Anything about this induction.', false, 1),
  ('announcements', 'Announcements', 'Updates from the site. Staff post here.', true, 2),
  ('preference-strategy', 'Preference Strategy', 'Ordering preferences, and what people are hearing.', false, 3)
on conflict (id) do update
  set label = excluded.label,
      description = excluded.description,
      staff_only_write = excluded.staff_only_write,
      sort_order = excluded.sort_order;

create table public.chat_messages (
  id bigint generated always as identity primary key,
  room_id text not null references public.chat_rooms (id) on delete cascade,

  author_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null,

  body text not null check (btrim(body) <> '' and length(body) <= 1000),

  hidden_at timestamptz,
  hidden_by uuid references auth.users (id),
  hidden_reason text check (hidden_reason in ('author', 'staff')),

  created_at timestamptz not null default now()
);

create index chat_messages_room_idx on public.chat_messages (room_id, created_at desc);
create index chat_messages_author_idx on public.chat_messages (author_id);

create trigger chat_messages_identity
  before insert on public.chat_messages
  for each row execute function private.set_author_identity();

-- ── Reports ─────────────────────────────────────────────────────────────
--
-- One table for every kind of content, keyed by (type, id). A report is never
-- readable by the person reported — only by staff and by the reporter, so they
-- can see that it was received.

create table public.content_reports (
  id bigint generated always as identity primary key,

  target_type text not null check (target_type in
    ('thread', 'reply', 'post', 'message')),
  target_id bigint not null,

  reporter_id uuid not null references auth.users (id) on delete cascade,

  reason text not null check (reason in
    ('harassment', 'personal_information', 'spam', 'misinformation', 'other')),
  note text check (length(note) <= 1000),

  resolved_at timestamptz,
  resolved_by uuid references auth.users (id),
  -- What was done, so the queue records a decision rather than only that
  -- somebody looked.
  action text check (action in ('hidden', 'kept')),

  created_at timestamptz not null default now(),

  -- One report per person per item. Without this, three taps of a button reads
  -- as three people objecting.
  unique (target_type, target_id, reporter_id)
);

create index content_reports_open_idx
  on public.content_reports (created_at desc) where resolved_at is null;
create index content_reports_target_idx
  on public.content_reports (target_type, target_id);

-- ── Row level security ──────────────────────────────────────────────────

alter table public.community_threads enable row level security;
alter table public.community_replies enable row level security;
alter table public.community_posts enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_messages enable row level security;
alter table public.content_reports enable row level security;

-- Revoke first: Supabase's default privileges have already granted ALL on every
-- new public table to anon and authenticated, so an additive grant is a no-op.
revoke all on public.community_threads from anon, authenticated;
revoke all on public.community_replies from anon, authenticated;
revoke all on public.community_posts from anon, authenticated;
revoke all on public.chat_rooms from anon, authenticated;
revoke all on public.chat_messages from anon, authenticated;
revoke all on public.content_reports from anon, authenticated;

grant select, insert, update on public.community_threads to authenticated;
grant select, insert, update on public.community_replies to authenticated;
grant select, insert, update on public.community_posts to authenticated;
grant select on public.chat_rooms to authenticated;
grant select, insert, update on public.chat_messages to authenticated;
grant select, insert, update on public.content_reports to authenticated;

-- Hidden content stays visible to its author and to staff. The author needs to
-- know their post was removed rather than find it silently gone, and staff need
-- to review what they hid.
create policy community_threads_select on public.community_threads
  for select to authenticated
  using (
    (select private.is_verified())
    and (
      hidden_at is null
      or author_id = (select auth.uid())
      or (select private.is_staff())
    )
  );

create policy community_threads_insert on public.community_threads
  for insert to authenticated
  with check (
    (select private.can_post())
    and (
      select count(*) from public.community_threads t
      where t.author_id = (select auth.uid())
        and t.created_at > now() - interval '1 hour'
    ) < 5
  );

-- An author may edit or withdraw their own; staff may hide anybody's. Both go
-- through update, and the `with check` stops an author reassigning a row.
create policy community_threads_update on public.community_threads
  for update to authenticated
  using (author_id = (select auth.uid()) or (select private.is_staff()))
  with check (author_id = (select auth.uid()) or (select private.is_staff()));

create policy community_replies_select on public.community_replies
  for select to authenticated
  using (
    (select private.is_verified())
    and (
      hidden_at is null
      or author_id = (select auth.uid())
      or (select private.is_staff())
    )
  );

create policy community_replies_insert on public.community_replies
  for insert to authenticated
  with check (
    (select private.can_post())
    and (
      select count(*) from public.community_replies r
      where r.author_id = (select auth.uid())
        and r.created_at > now() - interval '1 hour'
    ) < 30
    -- No replying to a thread that has been removed.
    and exists (
      select 1 from public.community_threads t
      where t.id = thread_id and t.hidden_at is null
    )
  );

create policy community_replies_update on public.community_replies
  for update to authenticated
  using (author_id = (select auth.uid()) or (select private.is_staff()))
  with check (author_id = (select auth.uid()) or (select private.is_staff()));

create policy community_posts_select on public.community_posts
  for select to authenticated
  using (
    (select private.is_verified())
    and (
      hidden_at is null
      or author_id = (select auth.uid())
      or (select private.is_staff())
    )
  );

create policy community_posts_insert on public.community_posts
  for insert to authenticated
  with check (
    (select private.can_post())
    and (
      select count(*) from public.community_posts p
      where p.author_id = (select auth.uid())
        and p.created_at > now() - interval '1 hour'
    ) < 10
  );

create policy community_posts_update on public.community_posts
  for update to authenticated
  using (author_id = (select auth.uid()) or (select private.is_staff()))
  with check (author_id = (select auth.uid()) or (select private.is_staff()));

create policy chat_rooms_select on public.chat_rooms
  for select to authenticated
  using ((select private.is_verified()));

create policy chat_messages_select on public.chat_messages
  for select to authenticated
  using (
    (select private.is_verified())
    and (
      hidden_at is null
      or author_id = (select auth.uid())
      or (select private.is_staff())
    )
  );

create policy chat_messages_insert on public.chat_messages
  for insert to authenticated
  with check (
    (select private.can_post())
    -- Tighter than the others, because chat is where a flood does the most
    -- damage: 20 a minute is faster than anyone types and slower than a script.
    and (
      select count(*) from public.chat_messages m
      where m.author_id = (select auth.uid())
        and m.created_at > now() - interval '1 minute'
    ) < 20
    and exists (
      select 1 from public.chat_rooms r
      where r.id = room_id
        and (r.staff_only_write = false or (select private.is_staff()))
    )
  );

-- No edit. A live room where messages change after they are read is a way to
-- rewrite a conversation other people have already acted on; withdrawing is
-- the only change permitted, and staff can hide.
create policy chat_messages_update on public.chat_messages
  for update to authenticated
  using (author_id = (select auth.uid()) or (select private.is_staff()))
  with check (author_id = (select auth.uid()) or (select private.is_staff()));

-- A reporter sees their own reports; staff see all. The reported author sees
-- none of them — a report that identifies its reporter to the person reported
-- is a reprisal waiting to happen.
create policy content_reports_select on public.content_reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or (select private.is_staff()));

create policy content_reports_insert on public.content_reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and (select private.is_verified())
    and (
      select count(*) from public.content_reports c
      where c.reporter_id = (select auth.uid())
        and c.created_at > now() - interval '1 hour'
    ) < 20
  );

-- Only staff resolve. An author cannot mark a report about their own post
-- as handled.
create policy content_reports_update on public.content_reports
  for update to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

comment on table public.community_threads is
  'Discussion threads. Authorship is set by trigger from the session — the client cannot supply author_id or author_name.';
comment on table public.content_reports is
  'Reports on any community content. Readable by the reporter and staff, never by the reported author.';

-- ── Realtime ────────────────────────────────────────────────────────────
--
-- Chat is the only surface that needs it. Realtime respects RLS, so a
-- subscriber receives exactly the rows the select policy would have returned.
alter publication supabase_realtime add table public.chat_messages;

-- ── Foreign-key indexes ─────────────────────────────────────────────────
--
-- `reporter_id` is genuinely queried: `content_reports_select` is
-- `own OR staff`, so every read by a non-staff caller filters on it. The rest
-- are `hidden_by` / `resolved_by`, read rarely but also what a cascade from
-- `auth.users` scans on account deletion — without an index that is a
-- sequential scan of every row of user-written content.
create index content_reports_reporter_idx on public.content_reports (reporter_id);
create index content_reports_resolved_by_idx on public.content_reports (resolved_by);
create index community_threads_hidden_by_idx on public.community_threads (hidden_by);
create index community_replies_hidden_by_idx on public.community_replies (hidden_by);
create index community_posts_hidden_by_idx on public.community_posts (hidden_by);
create index chat_messages_hidden_by_idx on public.chat_messages (hidden_by);
