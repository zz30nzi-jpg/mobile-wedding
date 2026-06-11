-- Run this file in Supabase SQL Editor to repair guest photo uploads.
-- Supabase Storage automatically fills owner_id from the authenticated JWT.
-- Anonymous sign-ins also use the authenticated Postgres role.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'guest-photos',
  'guest-photos',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'video/mp4', 'video/webm', 'video/quicktime'];

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/svg+xml', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'video/mp4', 'video/webm', 'video/quicktime']
where id = 'invitation-media';

drop policy if exists "guests can upload private wedding photos" on storage.objects;
create policy "guests can upload private wedding photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'guest-photos'
  and owner_id = (select auth.uid())::text
);

drop policy if exists "guests can read own private wedding photos" on storage.objects;
create policy "guests can read own private wedding photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'guest-photos'
  and owner_id = (select auth.uid())::text
);

drop policy if exists "guests can delete own private wedding photos" on storage.objects;
create policy "guests can delete own private wedding photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'guest-photos'
  and owner_id = (select auth.uid())::text
);
