-- Fixes two things the community migration got wrong, both found by probing the
-- tables before any UI existed.
--
-- ## 1. The rate limits recursed
--
-- They were written as subqueries inside each insert policy, counting the very
-- table the policy guards. Postgres refuses that outright:
--
--   infinite recursion detected in policy for relation "community_threads"
--
-- Evaluating the policy requires a select on the table, which requires
-- evaluating a policy, and so on. Every insert failed.
--
-- Moving each count into a `security definer` function in the non-exposed
-- `private` schema breaks the cycle: that function reads with RLS bypassed and
-- therefore never re-enters the policy.
--
-- Worth being precise about what this widens. Each function counts only the
-- **caller's own** rows, returns an integer, and lives in `private`, which is
-- not on the REST API — no row, and nothing about anybody else, is reachable
-- through any of them.
--
-- ## 2. The identity trigger locked out the service role
--
-- It overwrote `author_id` from `auth.uid()` unconditionally, so a service-role
-- insert — which has no session — produced a null and failed the not-null
-- constraint. That made the tables impossible to seed or test.
--
-- Letting the service role through grants nothing. It already bypasses RLS
-- entirely and can write any row in any table, so refusing here would protect
-- nothing while making the tables untestable. For anybody holding a user token
-- the rule is unchanged: identity comes from the session, and there is no field
-- in which to ask to be somebody else.

create or replace function private.my_threads_last_hour()
returns integer language sql stable security definer set search_path = ''
as $fn$
  select count(*)::int from public.community_threads
  where author_id = (select auth.uid()) and created_at > now() - interval '1 hour';
$fn$;

create or replace function private.my_replies_last_hour()
returns integer language sql stable security definer set search_path = ''
as $fn$
  select count(*)::int from public.community_replies
  where author_id = (select auth.uid()) and created_at > now() - interval '1 hour';
$fn$;

create or replace function private.my_posts_last_hour()
returns integer language sql stable security definer set search_path = ''
as $fn$
  select count(*)::int from public.community_posts
  where author_id = (select auth.uid()) and created_at > now() - interval '1 hour';
$fn$;

create or replace function private.my_messages_last_minute()
returns integer language sql stable security definer set search_path = ''
as $fn$
  select count(*)::int from public.chat_messages
  where author_id = (select auth.uid()) and created_at > now() - interval '1 minute';
$fn$;

create or replace function private.my_reports_last_hour()
returns integer language sql stable security definer set search_path = ''
as $fn$
  select count(*)::int from public.content_reports
  where reporter_id = (select auth.uid()) and created_at > now() - interval '1 hour';
$fn$;

-- RLS policies evaluate as the calling role, so these must be executable by it.
-- Revoking EXECUTE does not harden them; it makes every insert error out.
grant execute on function private.my_threads_last_hour() to authenticated;
grant execute on function private.my_replies_last_hour() to authenticated;
grant execute on function private.my_posts_last_hour() to authenticated;
grant execute on function private.my_messages_last_minute() to authenticated;
grant execute on function private.my_reports_last_hour() to authenticated;

drop policy community_threads_insert on public.community_threads;
create policy community_threads_insert on public.community_threads
  for insert to authenticated
  with check ((select private.can_post()) and private.my_threads_last_hour() < 5);

drop policy community_replies_insert on public.community_replies;
create policy community_replies_insert on public.community_replies
  for insert to authenticated
  with check (
    (select private.can_post())
    and private.my_replies_last_hour() < 30
    and exists (
      select 1 from public.community_threads t
      where t.id = thread_id and t.hidden_at is null
    )
  );

drop policy community_posts_insert on public.community_posts;
create policy community_posts_insert on public.community_posts
  for insert to authenticated
  with check ((select private.can_post()) and private.my_posts_last_hour() < 10);

drop policy chat_messages_insert on public.chat_messages;
create policy chat_messages_insert on public.chat_messages
  for insert to authenticated
  with check (
    (select private.can_post())
    and private.my_messages_last_minute() < 20
    and exists (
      select 1 from public.chat_rooms r
      where r.id = room_id
        and (r.staff_only_write = false or (select private.is_staff()))
    )
  );

drop policy content_reports_insert on public.content_reports;
create policy content_reports_insert on public.content_reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and (select private.is_verified())
    and private.my_reports_last_hour() < 20
  );

create or replace function private.set_author_identity()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_name text;
begin
  if v_uid is null then
    if new.author_id is null or coalesce(btrim(new.author_name), '') = '' then
      raise exception 'author_id and author_name are required when writing without a session';
    end if;
    return new;
  end if;

  new.author_id := v_uid;

  select btrim(p.display_name) into v_name
  from public.profiles p
  where p.user_id = v_uid;

  if coalesce(v_name, '') = '' then
    raise exception 'Set a display name on your profile before posting.';
  end if;

  new.author_name := v_name;
  return new;
end;
$fn$;
