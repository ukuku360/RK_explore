-- Community Posts Table
create table if not exists public.community_posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  author text not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.community_posts enable row level security;

-- Policies
create policy "Community posts are viewable by everyone"
  on public.community_posts for select
  using ( true );

create policy "Users can insert their own community posts"
  on public.community_posts for insert
  with check ( auth.uid() = user_id );

create policy "Users can delete their own community posts"
  on public.community_posts for delete
  using ( auth.uid() = user_id );

create policy "Users can update their own community posts"
  on public.community_posts for update
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

-- Enable Realtime
alter publication supabase_realtime add table public.community_posts;

-- Community Likes
create table if not exists public.community_likes (
  post_id uuid references public.community_posts(id) on delete cascade not null,
  user_id uuid references auth.users not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (post_id, user_id)
);

alter table public.community_likes enable row level security;

create policy "Community likes are viewable by everyone"
  on public.community_likes for select using (true);

create policy "Users can insert their own likes"
  on public.community_likes for insert with check (auth.uid() = user_id);

create policy "Users can delete their own likes"
  on public.community_likes for delete using (auth.uid() = user_id);

alter publication supabase_realtime add table public.community_likes;

-- Community Comments
create table if not exists public.community_comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.community_posts(id) on delete cascade not null,
  user_id uuid references auth.users not null,
  author text not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.community_comments enable row level security;

create policy "Community comments are viewable by everyone"
  on public.community_comments for select using (true);

create policy "Users can insert their own comments"
  on public.community_comments for insert with check (auth.uid() = user_id);

create policy "Users can delete their own comments"
  on public.community_comments for delete using (auth.uid() = user_id);

create policy "Users can update their own community comments"
  on public.community_comments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter publication supabase_realtime add table public.community_comments;

-- ─── Activity Updated At Tracking ────────────────────────────────────────────

create or replace function public.set_activity_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

alter table if exists public.posts
  add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now()) not null;

alter table if exists public.comments
  add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now()) not null;

alter table if exists public.community_posts
  add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now()) not null;

alter table if exists public.community_comments
  add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now()) not null;

do $$
begin
  if to_regclass('public.posts') is not null then
    execute 'drop trigger if exists trg_posts_updated_at on public.posts';
    execute
      'create trigger trg_posts_updated_at before update on public.posts for each row execute function public.set_activity_row_updated_at()';
  end if;

  if to_regclass('public.comments') is not null then
    execute 'drop trigger if exists trg_comments_updated_at on public.comments';
    execute
      'create trigger trg_comments_updated_at before update on public.comments for each row execute function public.set_activity_row_updated_at()';
  end if;

  if to_regclass('public.community_posts') is not null then
    execute 'drop trigger if exists trg_community_posts_updated_at on public.community_posts';
    execute
      'create trigger trg_community_posts_updated_at before update on public.community_posts for each row execute function public.set_activity_row_updated_at()';
  end if;

  if to_regclass('public.community_comments') is not null then
    execute 'drop trigger if exists trg_community_comments_updated_at on public.community_comments';
    execute
      'create trigger trg_community_comments_updated_at before update on public.community_comments for each row execute function public.set_activity_row_updated_at()';
  end if;
end;
$$;

-- ─── Post Images ──────────────────────────────────────────────────────────────

-- Add image_url column to posts table
alter table public.posts add column if not exists image_url text default null;

-- Storage bucket for post images
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

-- Storage RLS: anyone can read public images
create policy "Post images are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'post-images' );

-- Storage RLS: authenticated users can upload their own images
create policy "Users can upload post images"
  on storage.objects for insert
  with check (
    bucket_id = 'post-images'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage RLS: users can delete their own images
create policy "Users can delete their own post images"
  on storage.objects for delete
  using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── User Profile Details (About Me) ─────────────────────────────────────────

create table if not exists public.user_profile_details (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tagline text not null default '',
  bio text not null default '',
  location text not null default '',
  country text not null default '',
  city text not null default '',
  uni text not null default '',
  major text not null default '',
  instagram_url text not null default '',
  linkedin_url text not null default '',
  occupations text not null default '',
  hobbies text not null default '',
  links text not null default '',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.user_profile_details enable row level security;

create or replace function public.set_user_profile_details_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists trg_user_profile_details_updated_at on public.user_profile_details;
create trigger trg_user_profile_details_updated_at
before update on public.user_profile_details
for each row
execute function public.set_user_profile_details_updated_at();

-- Everyone can read profile details.
drop policy if exists "Profile details are viewable by everyone" on public.user_profile_details;
create policy "Profile details are viewable by everyone"
  on public.user_profile_details for select
  using (true);

-- Authenticated users can create their own profile details row.
drop policy if exists "Users can insert their own profile details" on public.user_profile_details;
create policy "Users can insert their own profile details"
  on public.user_profile_details for insert
  with check (auth.uid() = user_id);

-- Authenticated users can update only their own profile details.
drop policy if exists "Users can update their own profile details" on public.user_profile_details;
create policy "Users can update their own profile details"
  on public.user_profile_details for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Optional: allow users to delete only their own profile details.
drop policy if exists "Users can delete their own profile details" on public.user_profile_details;
create policy "Users can delete their own profile details"
  on public.user_profile_details for delete
  using (auth.uid() = user_id);

alter publication supabase_realtime add table public.user_profile_details;

-- ─── Profile Image Support ────────────────────────────────────────────────────

alter table public.user_profile_details add column if not exists avatar_url text default null;

insert into storage.buckets (id, name, public)
values ('profile-images', 'profile-images', true)
on conflict (id) do nothing;

drop policy if exists "Profile images are publicly accessible" on storage.objects;
create policy "Profile images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'profile-images');

drop policy if exists "Users can upload their profile images" on storage.objects;
create policy "Users can upload their profile images"
  on storage.objects for insert
  with check (
    bucket_id = 'profile-images'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their profile images" on storage.objects;
create policy "Users can update their profile images"
  on storage.objects for update
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their profile images" on storage.objects;
create policy "Users can delete their profile images"
  on storage.objects for delete
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Security Hardening: role-based admin + authenticated-only resident reads
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'resident',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint user_roles_role_check check (role in ('resident', 'admin'))
);

alter table public.user_roles enable row level security;

create or replace function public.set_user_roles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists trg_user_roles_updated_at on public.user_roles;
create trigger trg_user_roles_updated_at
before update on public.user_roles
for each row
execute function public.set_user_roles_updated_at();

drop policy if exists "Users can view their own role" on public.user_roles;
create policy "Users can view their own role"
  on public.user_roles for select
  using (auth.uid() = user_id);

drop policy if exists "Service role can manage user roles" on public.user_roles;
create policy "Service role can manage user roles"
  on public.user_roles for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.user_roles roles
      where roles.user_id = auth.uid()
        and roles.role = 'admin'
    );
$$;

drop policy if exists "Community posts are viewable by everyone" on public.community_posts;
drop policy if exists "Community posts are viewable by authenticated users" on public.community_posts;
create policy "Community posts are viewable by authenticated users"
  on public.community_posts for select
  using (auth.uid() is not null);

drop policy if exists "Community likes are viewable by everyone" on public.community_likes;
drop policy if exists "Community likes are viewable by authenticated users" on public.community_likes;
create policy "Community likes are viewable by authenticated users"
  on public.community_likes for select
  using (auth.uid() is not null);

drop policy if exists "Community comments are viewable by everyone" on public.community_comments;
drop policy if exists "Community comments are viewable by authenticated users" on public.community_comments;
create policy "Community comments are viewable by authenticated users"
  on public.community_comments for select
  using (auth.uid() is not null);

drop policy if exists "Profile details are viewable by everyone" on public.user_profile_details;
drop policy if exists "Profile details are viewable by authenticated users" on public.user_profile_details;
create policy "Profile details are viewable by authenticated users"
  on public.user_profile_details for select
  using (auth.uid() is not null);

do $$
begin
  if to_regclass('public.community_policy_versions') is not null then
    execute 'drop policy if exists "Community policy versions are viewable by everyone" on public.community_policy_versions';
    execute 'drop policy if exists "Community policy versions are viewable by authenticated users" on public.community_policy_versions';
    execute 'create policy "Community policy versions are viewable by authenticated users" on public.community_policy_versions for select using (auth.uid() is not null)';
  end if;
end
$$;

drop policy if exists "Admins can delete any community posts" on public.community_posts;
create policy "Admins can delete any community posts"
  on public.community_posts
  for delete
  using (public.is_admin());

do $$
begin
  if to_regclass('public.post_reports') is not null then
    execute 'alter table public.post_reports enable row level security';
    execute 'drop policy if exists "post_reports_select_owner_or_admin" on public.post_reports';
    execute 'drop policy if exists "post_reports_insert_own" on public.post_reports';
    execute 'drop policy if exists "post_reports_delete_owner_or_admin" on public.post_reports';
    execute 'drop policy if exists "post_reports_delete_own_or_admin" on public.post_reports';
    execute 'drop policy if exists "post_reports_update_admin_only" on public.post_reports';

    execute 'create policy "post_reports_select_owner_or_admin" on public.post_reports for select using (auth.uid() = reporter_user_id or public.is_admin())';
    execute 'create policy "post_reports_insert_own" on public.post_reports for insert with check (auth.uid() = reporter_user_id)';
    execute 'create policy "post_reports_delete_own_or_admin" on public.post_reports for delete using (auth.uid() = reporter_user_id or public.is_admin())';
    execute 'create policy "post_reports_update_admin_only" on public.post_reports for update using (public.is_admin()) with check (public.is_admin())';
  end if;
end
$$;

do $$
begin
  if to_regclass('public.admin_action_logs') is not null then
    execute 'alter table public.admin_action_logs enable row level security';
    execute 'drop policy if exists "admin_action_logs_select_admin_only" on public.admin_action_logs';
    execute 'drop policy if exists "admin_action_logs_insert_admin_only" on public.admin_action_logs';
    execute 'drop policy if exists "admin_action_logs_update_admin_only" on public.admin_action_logs';
    execute 'drop policy if exists "admin_action_logs_delete_admin_only" on public.admin_action_logs';

    execute 'create policy "admin_action_logs_select_admin_only" on public.admin_action_logs for select using (public.is_admin())';
    execute 'create policy "admin_action_logs_insert_admin_only" on public.admin_action_logs for insert with check (public.is_admin())';
    execute 'create policy "admin_action_logs_update_admin_only" on public.admin_action_logs for update using (public.is_admin()) with check (public.is_admin())';
    execute 'create policy "admin_action_logs_delete_admin_only" on public.admin_action_logs for delete using (public.is_admin())';
  end if;
end
$$;

-- Feed RLS lockdown for resident launch
do $$
declare
  policy_record record;
  has_is_admin boolean;
begin
  select to_regprocedure('public.is_admin()') is not null into has_is_admin;

  if to_regclass('public.posts') is not null then
    for policy_record in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = 'posts'
    loop
      execute format('drop policy if exists %I on public.posts', policy_record.policyname);
    end loop;

    execute 'alter table public.posts enable row level security';
    execute 'create policy "Posts are viewable by authenticated users" on public.posts for select using (auth.uid() is not null)';
    execute 'create policy "Users can insert their own posts" on public.posts for insert with check (auth.uid() = user_id)';

    if has_is_admin then
      execute 'create policy "Users and admins can update posts" on public.posts for update using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin())';
      execute 'create policy "Users and admins can delete posts" on public.posts for delete using (auth.uid() = user_id or public.is_admin())';
    else
      execute 'create policy "Users can update their own posts" on public.posts for update using (auth.uid() = user_id) with check (auth.uid() = user_id)';
      execute 'create policy "Users can delete their own posts" on public.posts for delete using (auth.uid() = user_id)';
    end if;
  end if;

  if to_regclass('public.comments') is not null then
    for policy_record in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = 'comments'
    loop
      execute format('drop policy if exists %I on public.comments', policy_record.policyname);
    end loop;

    execute 'alter table public.comments enable row level security';
    execute 'create policy "Comments are viewable by authenticated users" on public.comments for select using (auth.uid() is not null)';
    execute 'create policy "Users can insert their own comments" on public.comments for insert with check (auth.uid() = user_id)';
    execute 'create policy "Users can update their own comments" on public.comments for update using (auth.uid() = user_id) with check (auth.uid() = user_id)';
    execute 'create policy "Users can delete their own comments" on public.comments for delete using (auth.uid() = user_id)';
  end if;

  if to_regclass('public.votes') is not null then
    for policy_record in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = 'votes'
    loop
      execute format('drop policy if exists %I on public.votes', policy_record.policyname);
    end loop;

    execute 'alter table public.votes enable row level security';
    execute 'create policy "Votes are viewable by authenticated users" on public.votes for select using (auth.uid() is not null)';
    execute 'create policy "Users can insert their own votes" on public.votes for insert with check (auth.uid()::text = user_id::text)';
    execute 'create policy "Users can delete their own votes" on public.votes for delete using (auth.uid()::text = user_id::text)';
  end if;

  if to_regclass('public.rsvps') is not null then
    for policy_record in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = 'rsvps'
    loop
      execute format('drop policy if exists %I on public.rsvps', policy_record.policyname);
    end loop;

    execute 'alter table public.rsvps enable row level security';
    execute 'create policy "Rsvps are viewable by authenticated users" on public.rsvps for select using (auth.uid() is not null)';
    execute 'create policy "Users can insert their own rsvps" on public.rsvps for insert with check (auth.uid()::text = user_id::text)';
    execute 'create policy "Users can delete their own rsvps" on public.rsvps for delete using (auth.uid()::text = user_id::text)';
  end if;
end
$$;
