-- Storage for profile photos.
--
-- ## The bucket is PRIVATE, and that is the whole decision
--
-- A public Supabase bucket serves its objects at a stable URL with no
-- authentication, forever. That is the exact shape of the original's failure:
-- files sitting at public URLs that nobody had to sign in to fetch.
--
-- What a candidate opts into on `/app/profile` is being visible to other
-- verified candidates. It is not consent to a permanent unauthenticated URL
-- carrying a photograph of their face next to their name and the cycle they
-- applied in. Those are different things, and a public bucket quietly converts
-- the first into the second.
--
-- So another candidate's photo reaches a browser only through a short-lived
-- signed URL minted server-side, after the caller has been through whatever
-- gate the surface requires. `anon` gets nothing at all, and an authenticated
-- caller can read exactly one path: their own.
--
-- ## The select policy is scoped to the owner's folder, and it is required
--
-- The first version had **no** select policy, on the reasoning that reads
-- should be server-minted only. That broke the upload: `upsert` makes
-- storage-api run an `insert … on conflict do update`, which has to read the
-- existing row, so with no select policy every upload failed with "new row
-- violates row-level security policy" — an error that names the insert and is
-- caused by the read.
--
-- Scoping the select to `(storage.foldername(name))[1] = auth.uid()` keeps the
-- property that actually mattered: nobody can enumerate the bucket, and nobody
-- can fetch somebody else's photo by guessing a path. All it adds is that a
-- person may read back their own face, which they uploaded.
--
-- ## Writes are the owner's folder only
--
-- Unlike `payment-proofs`, where uploads run through the service role because
-- the uploader has no account yet, here the uploader is signed in. So they may
-- write their own folder directly, keyed on `auth.uid()` and nothing in the
-- request. One object per user at `<uid>/avatar`, upserted, so a new photo
-- replaces the old one rather than leaving every photo the person has ever set
-- lying in the bucket with no way to reach or remove it.
--
-- ## SVG is not an allowed type
--
-- An SVG is a document that can carry script. These are private objects reached
-- by signed URL and never rendered as HTML, so the risk is small, but there is
-- no reason to accept a format whose whole difference from the others is that
-- it can execute.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  2 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- `storage.foldername(name)` splits the object path; element 1 is the first
-- segment. Authorising from `auth.uid()` rather than from anything in the
-- payload is the same rule every policy in this project follows.
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Required by `upsert`, and scoped to one folder — see the header. Reads of
-- anybody else's photo are still server-minted signed URLs only.
create policy avatars_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
