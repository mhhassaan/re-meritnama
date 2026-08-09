-- RLS policy expressions are evaluated as the CALLING role, not the table
-- owner. Revoking EXECUTE from `authenticated` therefore did not harden these
-- helpers — it broke every policy that calls them, which failed with
-- "permission denied for function is_staff" instead of evaluating to false.
--
-- The real protection is that `private` is not a PostgREST-exposed schema, so
-- these are unreachable via /rest/v1/rpc regardless of grants. Granting EXECUTE
-- to `authenticated` is required for the policies to evaluate at all.
--
-- anon deliberately gets nothing: the only anon-facing policy
-- (access_logs insert) has a constant check and calls no helper.
grant execute on function private.is_staff()       to authenticated;
grant execute on function private.is_super_admin() to authenticated;
grant execute on function private.is_verified()    to authenticated;

-- current_role_name() is not referenced by any policy, so it stays revoked.
