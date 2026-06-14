-- Supabase SQL Editor에서 실행하세요. 설정 변경 후 다시 실행해도 됩니다.

create table if not exists public.invitation_sites (
  slug text primary key check (slug ~ '^[a-z0-9가-힣-]{2,48}$'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '청첩장',
  groom_name text not null default '',
  bride_name text not null default '',
  signup_email text,
  recovery_name text,
  recovery_phone text,
  disabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists invitation_sites_owner_idx on public.invitation_sites(owner_id);
alter table public.invitation_sites
  add column if not exists disabled boolean not null default false;
alter table public.invitation_sites
  add column if not exists recovery_name text;
alter table public.invitation_sites
  add column if not exists recovery_phone text;
create index if not exists invitation_sites_recovery_idx
  on public.invitation_sites(lower(recovery_name), recovery_phone)
  where recovery_name is not null and recovery_phone is not null;

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
grant insert on table public.attendance_responses to anon, authenticated;
grant select on table public.attendance_responses to authenticated;
grant select on table public.invitation_settings to authenticated;
grant insert, update, delete on table public.invitation_settings to authenticated;
grant insert on table public.guestbook_entries to anon, authenticated;
grant select on table public.guestbook_entries to authenticated;
grant update on table public.guestbook_entries to authenticated;

drop policy if exists "public can read invitation site slugs" on public.invitation_sites;
drop policy if exists "owners can read own invitation site" on public.invitation_sites;
create policy "owners can read own invitation site"
on public.invitation_sites for select
to authenticated
using ((select auth.uid()) = owner_id);

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
with check (
  exists (
    select 1
    from public.invitation_sites
    where slug = attendance_responses.invitation_id
      and disabled = false
  )
);

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
drop policy if exists "registered admins can read invitation settings" on public.invitation_settings;
create policy "registered admins can read invitation settings"
on public.invitation_settings for select
to authenticated
using (
  id in ('main', '_design_library')
  or exists (
    select 1 from public.invitation_sites where slug = id and owner_id = (select auth.uid())
  )
);

drop function if exists public.get_public_invitation(text);

create function public.get_public_invitation(invitation_slug text)
returns table(status text, content jsonb)
language sql
stable
security definer
set search_path = public
as $$
  with requested as (
    select coalesce(nullif(trim(invitation_slug), ''), 'main') as slug
  ),
  target as (
    select
      requested.slug,
      sites.disabled,
      settings.content
    from requested
    left join public.invitation_sites sites
      on sites.slug = requested.slug
    left join public.invitation_settings settings
      on settings.id = requested.slug
    where requested.slug = 'main' or sites.slug is not null
  )
  select
    case
      when not exists (select 1 from target) then 'not_found'
      when exists (select 1 from target where disabled = true) then 'disabled'
      when not exists (select 1 from target where content is not null and content <> '{}'::jsonb) then 'empty'
      else 'ok'
    end as status,
    case
      when exists (select 1 from target where coalesce(disabled, false) = false and content is not null and content <> '{}'::jsonb)
        then (
          select jsonb_set(
            content
              #- '{designSystem,aiSettings}'
              #- '{designSystem,deletedThemeIds}'
              #- '{designSystem,deletedAssetIds}',
            '{designSystem,layoutTemplates}',
            coalesce((
              select jsonb_agg(template.item)
              from jsonb_array_elements(coalesce(content #> '{designSystem,layoutTemplates}', '[]'::jsonb)) as template(item)
              where template.item->>'id' = content #>> '{designSystem,activeLayoutId}'
                and coalesce(template.item->>'builtIn', 'false') <> 'true'
            ), '[]'::jsonb),
            true
          )
          from target
          limit 1
        )
      else null::jsonb
    end as content
  limit 1
$$;

drop function if exists public.get_public_design_library();

revoke all on function public.get_public_invitation(text) from public;
grant execute on function public.get_public_invitation(text) to anon, authenticated;

drop function if exists public.find_admin_login_id(text, text);

create function public.find_admin_login_id(recovery_name_input text, recovery_phone_input text)
returns table(masked_email text)
language sql
stable
security definer
set search_path = public
as $$
  with normalized as (
    select
      lower(trim(coalesce(recovery_name_input, ''))) as recovery_name,
      regexp_replace(coalesce(recovery_phone_input, ''), '[^0-9]', '', 'g') as recovery_phone
  ),
  matched as (
    select sites.signup_email
    from public.invitation_sites sites, normalized
    where lower(trim(coalesce(sites.recovery_name, ''))) = normalized.recovery_name
      and regexp_replace(coalesce(sites.recovery_phone, ''), '[^0-9]', '', 'g') = normalized.recovery_phone
      and sites.signup_email is not null
      and char_length(normalized.recovery_name) >= 2
      and char_length(normalized.recovery_phone) >= 8
    order by sites.created_at desc
    limit 1
  )
  select
    case
      when position('@' in signup_email) <= 2 then regexp_replace(signup_email, '(^.).*(@.*$)', '\1***\2')
      else regexp_replace(signup_email, '(^.{2}).*(@.*$)', '\1***\2')
    end as masked_email
  from matched
$$;

revoke all on function public.find_admin_login_id(text, text) from public;
grant execute on function public.find_admin_login_id(text, text) to anon, authenticated;

drop function if exists public.get_public_guestbook_entries(text);

create function public.get_public_guestbook_entries(invitation_slug text)
returns table(id uuid, guest_name text, message text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with requested as (
    select coalesce(nullif(trim(invitation_slug), ''), 'main') as slug
  )
  select entries.id, entries.guest_name, entries.message, entries.created_at
  from public.guestbook_entries entries
  join requested on requested.slug = entries.invitation_id
  where entries.hidden = false
    and exists (
      select 1
      from public.invitation_sites sites
      where sites.slug = requested.slug
        and sites.disabled = false
    )
  order by entries.created_at desc
  limit 30
$$;

revoke all on function public.get_public_guestbook_entries(text) from public;
grant execute on function public.get_public_guestbook_entries(text) to anon, authenticated;

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
drop policy if exists "registered admins can read guestbook" on public.guestbook_entries;
create policy "registered admins can read guestbook"
on public.guestbook_entries for select
to authenticated
using (exists (
  select 1 from public.invitation_sites where slug = guestbook_entries.invitation_id and owner_id = (select auth.uid())
));

drop policy if exists "guests can write guestbook" on public.guestbook_entries;
create policy "guests can write guestbook"
on public.guestbook_entries for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.invitation_sites
    where slug = guestbook_entries.invitation_id
      and disabled = false
  )
);

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
