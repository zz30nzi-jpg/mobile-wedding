-- Supabase SQL Editor에서 실행하세요. 설정 변경 후 다시 실행해도 됩니다.

create table if not exists public.invitation_sites (
  slug text primary key check (slug ~ '^[a-z0-9가-힣-]{2,48}$'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '청첩장',
  groom_name text not null default '',
  bride_name text not null default '',
  signup_email text,
  disabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists invitation_sites_owner_idx on public.invitation_sites(owner_id);
alter table public.invitation_sites
  add column if not exists disabled boolean not null default false;

create table if not exists public.attendance_responses (
  id uuid primary key default gen_random_uuid(),
  invitation_id text not null default 'main',
  guest_name text not null check (char_length(guest_name) between 1 and 30),
  phone text not null check (char_length(phone) between 1 and 20),
  attendance text not null check (attendance in ('참석', '불참')),
  origin text,
  transport text,
  departure_date text,
  travel_details text not null default '' check (char_length(travel_details) <= 100),
  companions jsonb not null default '[]'::jsonb,
  companion_count integer not null default 0 check (companion_count >= 0),
  total_count integer not null default 0 check (total_count >= 0),
  needs_accommodation text check (needs_accommodation in ('예', '아니오', '미정')),
  accommodation_details text not null default '' check (char_length(accommodation_details) <= 120),
  notes text not null default '' check (char_length(notes) <= 500),
  created_at timestamptz not null default now()
);
alter table public.attendance_responses
  add column if not exists travel_details text not null default '';
alter table public.attendance_responses
  add column if not exists invitation_id text not null default 'main';
alter table public.attendance_responses
  add column if not exists accommodation_details text not null default '';
alter table public.attendance_responses
  add column if not exists side text check (side in ('신랑측', '신부측'));
alter table public.attendance_responses
  add column if not exists meal text check (meal in ('O', 'X'));
alter table public.attendance_responses
  alter column phone drop not null;

create table if not exists public.invitation_settings (
  id text primary key,
  content jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.guestbook_entries (
  id uuid primary key default gen_random_uuid(),
  invitation_id text not null default 'main',
  guest_name text not null check (char_length(guest_name) between 1 and 30),
  message text not null check (char_length(message) between 1 and 300),
  created_at timestamptz not null default now()
);
alter table public.guestbook_entries
  add column if not exists hidden boolean not null default false;
alter table public.guestbook_entries
  add column if not exists invitation_id text not null default 'main';

alter table public.invitation_sites enable row level security;
alter table public.attendance_responses enable row level security;
alter table public.invitation_settings enable row level security;
alter table public.guestbook_entries enable row level security;

revoke all on table public.invitation_sites from anon, authenticated;
revoke all on table public.attendance_responses from anon, authenticated;
revoke all on table public.invitation_settings from anon, authenticated;
revoke all on table public.guestbook_entries from anon, authenticated;
grant select, insert, update, delete on table public.invitation_sites to authenticated;
grant select on table public.invitation_sites to anon;
grant insert on table public.attendance_responses to anon, authenticated;
grant select on table public.attendance_responses to authenticated;
grant select on table public.invitation_settings to anon, authenticated;
grant insert, update, delete on table public.invitation_settings to authenticated;
grant select, insert on table public.guestbook_entries to anon, authenticated;
grant update on table public.guestbook_entries to authenticated;

drop policy if exists "public can read invitation site slugs" on public.invitation_sites;
create policy "public can read invitation site slugs"
on public.invitation_sites for select
to anon, authenticated
using (true);

drop policy if exists "owners can create own invitation site" on public.invitation_sites;
create policy "owners can create own invitation site"
on public.invitation_sites for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "owners can update own invitation site" on public.invitation_sites;
create policy "owners can update own invitation site"
on public.invitation_sites for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "owners can delete own invitation site" on public.invitation_sites;
create policy "owners can delete own invitation site"
on public.invitation_sites for delete
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "guests can submit attendance" on public.attendance_responses;
create policy "guests can submit attendance"
on public.attendance_responses for insert
to anon, authenticated
with check (true);

drop policy if exists "registered admins can read attendance" on public.attendance_responses;
create policy "registered admins can read attendance"
on public.attendance_responses for select
to authenticated
using (
  exists (
    select 1
    from public.invitation_sites
    where slug = attendance_responses.invitation_id
      and owner_id = (select auth.uid())
  )
);

drop policy if exists "guests can read invitation settings" on public.invitation_settings;
create policy "guests can read invitation settings"
on public.invitation_settings for select
to anon, authenticated
using (true);

drop policy if exists "registered admins can create invitation settings" on public.invitation_settings;
create policy "registered admins can create invitation settings"
on public.invitation_settings for insert
to authenticated
with check (
  exists (
    select 1 from public.invitation_sites where slug = id and owner_id = (select auth.uid())
  )
);

drop policy if exists "registered admins can update invitation settings" on public.invitation_settings;
create policy "registered admins can update invitation settings"
on public.invitation_settings for update
to authenticated
using (
  exists (
    select 1 from public.invitation_sites where slug = id and owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.invitation_sites where slug = id and owner_id = (select auth.uid())
  )
);

drop policy if exists "owners can delete own invitation settings" on public.invitation_settings;
create policy "owners can delete own invitation settings"
on public.invitation_settings for delete
to authenticated
using (
  exists (
    select 1 from public.invitation_sites where slug = id and owner_id = (select auth.uid())
  )
);

drop policy if exists "guests can read guestbook" on public.guestbook_entries;
create policy "guests can read guestbook"
on public.guestbook_entries for select
to anon, authenticated
using (hidden = false or exists (
  select 1 from public.invitation_sites where slug = guestbook_entries.invitation_id and owner_id = (select auth.uid())
));

drop policy if exists "guests can write guestbook" on public.guestbook_entries;
create policy "guests can write guestbook"
on public.guestbook_entries for insert
to anon, authenticated
with check (true);

drop policy if exists "registered admins can moderate guestbook" on public.guestbook_entries;
create policy "registered admins can moderate guestbook"
on public.guestbook_entries for update
to authenticated
using (
  exists (select 1 from public.invitation_sites where slug = guestbook_entries.invitation_id and owner_id = (select auth.uid()))
)
with check (
  exists (select 1 from public.invitation_sites where slug = guestbook_entries.invitation_id and owner_id = (select auth.uid()))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invitation-media', 'invitation-media', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'video/mp4', 'video/webm', 'video/quicktime', 'font/woff', 'font/woff2', 'font/ttf', 'font/otf', 'application/font-woff', 'application/font-woff2', 'application/x-font-woff', 'application/x-font-woff2', 'application/x-font-ttf', 'application/x-font-otf'])
on conflict (id) do update set
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'video/mp4', 'video/webm', 'video/quicktime', 'font/woff', 'font/woff2', 'font/ttf', 'font/otf', 'application/font-woff', 'application/font-woff2', 'application/x-font-woff', 'application/x-font-woff2', 'application/x-font-ttf', 'application/x-font-otf'];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guest-photos', 'guest-photos', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update set
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'video/mp4', 'video/webm', 'video/quicktime'];

drop policy if exists "registered admins can upload invitation images" on storage.objects;
create policy "registered admins can upload invitation images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'invitation-media' and exists (
    select 1 from public.invitation_sites
    where owner_id = (select auth.uid())
    and (storage.foldername(name))[1] = 'invitations'
    and slug = (storage.foldername(name))[2]
  )
);

drop policy if exists "registered admins can update invitation media" on storage.objects;
create policy "registered admins can update invitation media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'invitation-media' and exists (
    select 1 from public.invitation_sites
    where owner_id = (select auth.uid())
    and (storage.foldername(name))[1] = 'invitations'
    and slug = (storage.foldername(name))[2]
  )
)
with check (
  bucket_id = 'invitation-media' and exists (
    select 1 from public.invitation_sites
    where owner_id = (select auth.uid())
    and (storage.foldername(name))[1] = 'invitations'
    and slug = (storage.foldername(name))[2]
  )
);

drop policy if exists "registered admins can read invitation media" on storage.objects;
create policy "registered admins can read invitation media"
on storage.objects for select
to authenticated
using (
  bucket_id = 'invitation-media' and exists (
    select 1 from public.invitation_sites
    where owner_id = (select auth.uid())
    and (storage.foldername(name))[1] = 'invitations'
    and slug = (storage.foldername(name))[2]
  )
);

drop policy if exists "registered admins can delete invitation media" on storage.objects;
create policy "registered admins can delete invitation media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'invitation-media' and exists (
    select 1 from public.invitation_sites
    where owner_id = (select auth.uid())
    and (storage.foldername(name))[1] = 'invitations'
    and slug = (storage.foldername(name))[2]
  )
);

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

drop policy if exists "registered admins can read private wedding photos" on storage.objects;
create policy "registered admins can read private wedding photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'guest-photos' and exists (
    select 1 from public.invitation_sites
    where owner_id = (select auth.uid())
    and slug = (storage.foldername(name))[1]
  )
);

drop policy if exists "registered admins can delete private wedding photos" on storage.objects;
create policy "registered admins can delete private wedding photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'guest-photos' and exists (
    select 1 from public.invitation_sites
    where owner_id = (select auth.uid())
    and slug = (storage.foldername(name))[1]
  )
);
