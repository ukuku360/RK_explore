-- RKM-026
-- Expand post_reports to support feed/community targets and reporter nicknames,
-- and grant admin moderation visibility across both surfaces.

alter table if exists public.post_reports
  add column if not exists target_type text;

update public.post_reports
set target_type = 'feed'
where target_type is null or target_type = '';

alter table if exists public.post_reports
  alter column target_type set default 'feed';

alter table if exists public.post_reports
  alter column target_type set not null;

alter table if exists public.post_reports
  add column if not exists community_post_id uuid references public.community_posts(id) on delete cascade;

alter table if exists public.post_reports
  alter column post_id drop not null;

alter table if exists public.post_reports
  add column if not exists reporter_nickname text;

update public.post_reports
set reporter_nickname = coalesce(nullif(split_part(reporter_email, '@', 1), ''), 'member')
where reporter_nickname is null or btrim(reporter_nickname) = '';

alter table if exists public.post_reports
  alter column reporter_nickname set default '';

alter table if exists public.post_reports
  alter column reporter_nickname set not null;

alter table if exists public.post_reports
  drop constraint if exists post_reports_target_type_check;

alter table if exists public.post_reports
  add constraint post_reports_target_type_check check (target_type in ('feed', 'community'));

alter table if exists public.post_reports
  drop constraint if exists post_reports_target_consistency_check;

alter table if exists public.post_reports
  add constraint post_reports_target_consistency_check check (
    (target_type = 'feed' and post_id is not null and community_post_id is null)
    or
    (target_type = 'community' and community_post_id is not null and post_id is null)
  );

create index if not exists post_reports_target_created_idx
  on public.post_reports (target_type, created_at desc);

create index if not exists post_reports_feed_open_idx
  on public.post_reports (post_id, created_at desc)
  where target_type = 'feed' and status = 'open';

create index if not exists post_reports_community_open_idx
  on public.post_reports (community_post_id, created_at desc)
  where target_type = 'community' and status = 'open';

alter table if exists public.post_reports enable row level security;

drop policy if exists "post_reports_select_owner_or_admin" on public.post_reports;
create policy "post_reports_select_owner_or_admin"
  on public.post_reports
  for select
  using (
    auth.uid() = reporter_user_id
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'swanston@roomingkos.com'
  );

drop policy if exists "post_reports_insert_own" on public.post_reports;
create policy "post_reports_insert_own"
  on public.post_reports
  for insert
  with check (auth.uid() = reporter_user_id);

drop policy if exists "post_reports_delete_own_or_admin" on public.post_reports;
create policy "post_reports_delete_own_or_admin"
  on public.post_reports
  for delete
  using (
    auth.uid() = reporter_user_id
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'swanston@roomingkos.com'
  );

drop policy if exists "post_reports_update_admin_only" on public.post_reports;
create policy "post_reports_update_admin_only"
  on public.post_reports
  for update
  using (
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'swanston@roomingkos.com'
  )
  with check (
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'swanston@roomingkos.com'
  );

alter table if exists public.community_posts enable row level security;

drop policy if exists "Admins can delete any community posts" on public.community_posts;
create policy "Admins can delete any community posts"
  on public.community_posts
  for delete
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'swanston@roomingkos.com');

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'post_reports'
  ) then
    alter publication supabase_realtime add table public.post_reports;
  end if;
end
$$;
