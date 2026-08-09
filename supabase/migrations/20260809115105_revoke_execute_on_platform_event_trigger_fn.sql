-- public.rls_auto_enable() is a Supabase-provided event trigger function that
-- auto-enables RLS on newly created public tables. It is not meant to be an
-- API, but EXECUTE was granted to anon/authenticated, so PostgREST exposes it
-- at /rest/v1/rpc/rls_auto_enable.
--
-- Not directly exploitable — pg_event_trigger_ddl_commands() errors outside an
-- event-trigger context — but it is needless attack surface, and event triggers
-- fire as the system rather than via these grants, so revoking changes nothing
-- functionally.
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
