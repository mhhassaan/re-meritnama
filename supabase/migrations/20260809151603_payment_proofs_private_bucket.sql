-- Storage for payment proofs: bank transfer screenshots submitted with an
-- access request.
--
-- These are among the most sensitive objects in the product. A transfer
-- screenshot typically shows the sender's full name, account number, balance and
-- recent transactions — more financially exposing than anything in the candidate
-- record itself.
--
-- The bucket is PRIVATE. Objects are reachable only through a short-lived signed
-- URL minted server-side for a staff member, never by public URL.
--
-- Deliberately NO storage policy grants anon or authenticated any access:
--
--   * Uploads go through a server route using the service role. At upload time
--     the person has no account yet — they are submitting proof alongside an
--     access request — so there is no authenticated identity to key a policy on,
--     and an anon-writable bucket is an open file dump.
--
--   * Reads happen only via signed URLs minted server-side after a staff role
--     check. Staff get no blanket read policy, so a compromised staff session
--     cannot enumerate the bucket.
--
-- The absence of policies is the control here, not an oversight. storage.objects
-- already has RLS enabled by Supabase, so no policy means no client access.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  5 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
