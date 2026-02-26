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

-- Admin analytics event log (activation metrics)
create table if not exists public.analytics_events (
  id uuid default gen_random_uuid() primary key,
  event_name text not null check (char_length(trim(event_name)) > 0),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'member')),
  post_id uuid null,
  surface text not null default 'unknown',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at desc);
create index if not exists analytics_events_event_name_idx
  on public.analytics_events (event_name, created_at desc);
create index if not exists analytics_events_user_id_idx
  on public.analytics_events (user_id, created_at desc);

alter table public.analytics_events enable row level security;

drop policy if exists "Users can insert their own analytics events" on public.analytics_events;
create policy "Users can insert their own analytics events"
  on public.analytics_events for insert
  with check (auth.uid() = user_id);

drop policy if exists "Admins can read analytics events" on public.analytics_events;
create policy "Admins can read analytics events"
  on public.analytics_events for select
  using (public.is_admin());

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

-- Marketplace
create table if not exists public.marketplace_posts (
  id uuid default gen_random_uuid() primary key,
  seller_user_id uuid references auth.users(id) on delete cascade not null,
  seller_nickname text not null,
  title text not null,
  description text not null,
  asking_price numeric(12, 2) not null check (asking_price > 0),
  image_url text default null,
  status text not null default 'active' check (status in ('active', 'reserved', 'sold')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists marketplace_posts_created_at_idx
  on public.marketplace_posts (created_at desc);
create index if not exists marketplace_posts_status_idx
  on public.marketplace_posts (status, created_at desc);
create index if not exists marketplace_posts_seller_idx
  on public.marketplace_posts (seller_user_id, created_at desc);

alter table public.marketplace_posts enable row level security;

drop policy if exists "Marketplace posts are viewable by authenticated users" on public.marketplace_posts;
create policy "Marketplace posts are viewable by authenticated users"
  on public.marketplace_posts for select
  using (auth.uid() is not null);

drop policy if exists "Users can insert their own marketplace posts" on public.marketplace_posts;
create policy "Users can insert their own marketplace posts"
  on public.marketplace_posts for insert
  with check (auth.uid() = seller_user_id);

drop policy if exists "Users can update their own marketplace posts" on public.marketplace_posts;
create policy "Users can update their own marketplace posts"
  on public.marketplace_posts for update
  using (auth.uid() = seller_user_id)
  with check (auth.uid() = seller_user_id);

drop policy if exists "Users can delete their own marketplace posts" on public.marketplace_posts;
create policy "Users can delete their own marketplace posts"
  on public.marketplace_posts for delete
  using (auth.uid() = seller_user_id);

create table if not exists public.marketplace_comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.marketplace_posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  author text not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists marketplace_comments_post_idx
  on public.marketplace_comments (post_id, created_at asc);
create index if not exists marketplace_comments_user_idx
  on public.marketplace_comments (user_id, created_at desc);

alter table public.marketplace_comments enable row level security;

drop policy if exists "Marketplace comments are viewable by authenticated users" on public.marketplace_comments;
create policy "Marketplace comments are viewable by authenticated users"
  on public.marketplace_comments for select
  using (auth.uid() is not null);

drop policy if exists "Users can insert their own marketplace comments" on public.marketplace_comments;
create policy "Users can insert their own marketplace comments"
  on public.marketplace_comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own marketplace comments" on public.marketplace_comments;
create policy "Users can update their own marketplace comments"
  on public.marketplace_comments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own marketplace comments" on public.marketplace_comments;
create policy "Users can delete their own marketplace comments"
  on public.marketplace_comments for delete
  using (auth.uid() = user_id);

create table if not exists public.marketplace_bids (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.marketplace_posts(id) on delete cascade not null,
  bidder_user_id uuid references auth.users(id) on delete cascade not null,
  bidder_nickname text not null,
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (post_id, bidder_user_id)
);

create index if not exists marketplace_bids_post_idx
  on public.marketplace_bids (post_id, amount desc, updated_at desc);
create index if not exists marketplace_bids_bidder_idx
  on public.marketplace_bids (bidder_user_id, updated_at desc);

alter table public.marketplace_bids enable row level security;

drop policy if exists "Marketplace bids are viewable by authenticated users" on public.marketplace_bids;
create policy "Marketplace bids are viewable by authenticated users"
  on public.marketplace_bids for select
  using (auth.uid() is not null);

drop policy if exists "Users can insert their own marketplace bids" on public.marketplace_bids;
create policy "Users can insert their own marketplace bids"
  on public.marketplace_bids for insert
  with check (auth.uid() = bidder_user_id);

drop policy if exists "Users can update their own marketplace bids" on public.marketplace_bids;
create policy "Users can update their own marketplace bids"
  on public.marketplace_bids for update
  using (auth.uid() = bidder_user_id)
  with check (auth.uid() = bidder_user_id);

drop policy if exists "Users can delete their own marketplace bids" on public.marketplace_bids;
create policy "Users can delete their own marketplace bids"
  on public.marketplace_bids for delete
  using (auth.uid() = bidder_user_id);

create table if not exists public.marketplace_bid_events (
  id uuid default gen_random_uuid() primary key,
  bid_id uuid references public.marketplace_bids(id) on delete cascade not null,
  post_id uuid references public.marketplace_posts(id) on delete cascade not null,
  bidder_user_id uuid references auth.users(id) on delete cascade not null,
  bidder_nickname text not null,
  amount numeric(12, 2) not null check (amount > 0),
  event_type text not null check (event_type in ('created', 'updated')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists marketplace_bid_events_post_idx
  on public.marketplace_bid_events (post_id, created_at desc);
create index if not exists marketplace_bid_events_bid_idx
  on public.marketplace_bid_events (bid_id, created_at desc);

alter table public.marketplace_bid_events enable row level security;

drop policy if exists "Marketplace bid events are viewable by authenticated users" on public.marketplace_bid_events;
create policy "Marketplace bid events are viewable by authenticated users"
  on public.marketplace_bid_events for select
  using (auth.uid() is not null);

drop policy if exists "Users can insert their own marketplace bid events" on public.marketplace_bid_events;
create policy "Users can insert their own marketplace bid events"
  on public.marketplace_bid_events for insert
  with check (auth.uid() = bidder_user_id);

create or replace function public.log_marketplace_bid_event()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.marketplace_bid_events (
      bid_id,
      post_id,
      bidder_user_id,
      bidder_nickname,
      amount,
      event_type
    ) values (
      new.id,
      new.post_id,
      new.bidder_user_id,
      new.bidder_nickname,
      new.amount,
      'created'
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.amount is distinct from new.amount then
      insert into public.marketplace_bid_events (
        bid_id,
        post_id,
        bidder_user_id,
        bidder_nickname,
        amount,
        event_type
      ) values (
        new.id,
        new.post_id,
        new.bidder_user_id,
        new.bidder_nickname,
        new.amount,
        'updated'
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_marketplace_bids_log_event on public.marketplace_bids;
create trigger trg_marketplace_bids_log_event
after insert or update on public.marketplace_bids
for each row
execute function public.log_marketplace_bid_event();

create table if not exists public.marketplace_chat_threads (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.marketplace_posts(id) on delete cascade not null,
  post_title text not null,
  post_image_url text default null,
  seller_user_id uuid references auth.users(id) on delete cascade not null,
  seller_nickname text not null,
  buyer_user_id uuid references auth.users(id) on delete cascade not null,
  buyer_nickname text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_message_at timestamp with time zone default null,
  last_message_preview text default null,
  unique (post_id, buyer_user_id),
  constraint marketplace_chat_participants_different check (seller_user_id <> buyer_user_id)
);

create index if not exists marketplace_chat_threads_seller_idx
  on public.marketplace_chat_threads (seller_user_id, last_message_at desc);
create index if not exists marketplace_chat_threads_buyer_idx
  on public.marketplace_chat_threads (buyer_user_id, last_message_at desc);
create index if not exists marketplace_chat_threads_post_idx
  on public.marketplace_chat_threads (post_id);

alter table public.marketplace_chat_threads enable row level security;

drop policy if exists "Marketplace chat threads are visible to participants or admin" on public.marketplace_chat_threads;
create policy "Marketplace chat threads are visible to participants or admin"
  on public.marketplace_chat_threads for select
  using (
    public.is_admin()
    or auth.uid() = seller_user_id
    or auth.uid() = buyer_user_id
  );

drop policy if exists "Participants can create marketplace chat threads" on public.marketplace_chat_threads;
create policy "Participants can create marketplace chat threads"
  on public.marketplace_chat_threads for insert
  with check (
    auth.uid() is not null
    and (auth.uid() = seller_user_id or auth.uid() = buyer_user_id)
    and seller_user_id <> buyer_user_id
    and exists (
      select 1
      from public.marketplace_posts posts
      where posts.id = post_id
        and posts.seller_user_id = seller_user_id
    )
  );

drop policy if exists "Participants can update marketplace chat threads" on public.marketplace_chat_threads;
create policy "Participants can update marketplace chat threads"
  on public.marketplace_chat_threads for update
  using (
    public.is_admin()
    or auth.uid() = seller_user_id
    or auth.uid() = buyer_user_id
  )
  with check (
    public.is_admin()
    or auth.uid() = seller_user_id
    or auth.uid() = buyer_user_id
  );

create table if not exists public.marketplace_chat_messages (
  id uuid default gen_random_uuid() primary key,
  thread_id uuid references public.marketplace_chat_threads(id) on delete cascade not null,
  sender_user_id uuid references auth.users(id) on delete cascade not null,
  sender_nickname text not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists marketplace_chat_messages_thread_idx
  on public.marketplace_chat_messages (thread_id, created_at asc);
create index if not exists marketplace_chat_messages_sender_idx
  on public.marketplace_chat_messages (sender_user_id, created_at desc);

alter table public.marketplace_chat_messages enable row level security;

drop policy if exists "Marketplace chat messages are visible to participants or admin" on public.marketplace_chat_messages;
create policy "Marketplace chat messages are visible to participants or admin"
  on public.marketplace_chat_messages for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.marketplace_chat_threads threads
      where threads.id = thread_id
        and (threads.seller_user_id = auth.uid() or threads.buyer_user_id = auth.uid())
    )
  );

drop policy if exists "Participants can insert marketplace chat messages" on public.marketplace_chat_messages;
create policy "Participants can insert marketplace chat messages"
  on public.marketplace_chat_messages for insert
  with check (
    auth.uid() = sender_user_id
    and exists (
      select 1
      from public.marketplace_chat_threads threads
      where threads.id = thread_id
        and (threads.seller_user_id = auth.uid() or threads.buyer_user_id = auth.uid())
    )
  );

create or replace function public.marketplace_update_chat_thread_summary()
returns trigger
language plpgsql
as $$
begin
  update public.marketplace_chat_threads
  set
    last_message_at = new.created_at,
    last_message_preview = left(trim(new.content), 160)
  where id = new.thread_id;

  return new;
end;
$$;

drop trigger if exists trg_marketplace_chat_messages_summary on public.marketplace_chat_messages;
create trigger trg_marketplace_chat_messages_summary
after insert on public.marketplace_chat_messages
for each row
execute function public.marketplace_update_chat_thread_summary();

do $$
begin
  if to_regclass('public.marketplace_posts') is not null then
    execute 'drop trigger if exists trg_marketplace_posts_updated_at on public.marketplace_posts';
    execute
      'create trigger trg_marketplace_posts_updated_at before update on public.marketplace_posts for each row execute function public.set_activity_row_updated_at()';
  end if;

  if to_regclass('public.marketplace_comments') is not null then
    execute 'drop trigger if exists trg_marketplace_comments_updated_at on public.marketplace_comments';
    execute
      'create trigger trg_marketplace_comments_updated_at before update on public.marketplace_comments for each row execute function public.set_activity_row_updated_at()';
  end if;

  if to_regclass('public.marketplace_bids') is not null then
    execute 'drop trigger if exists trg_marketplace_bids_updated_at on public.marketplace_bids';
    execute
      'create trigger trg_marketplace_bids_updated_at before update on public.marketplace_bids for each row execute function public.set_activity_row_updated_at()';
  end if;
end
$$;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'marketplace_posts'
    ) then
      alter publication supabase_realtime add table public.marketplace_posts;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'marketplace_comments'
    ) then
      alter publication supabase_realtime add table public.marketplace_comments;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'marketplace_bids'
    ) then
      alter publication supabase_realtime add table public.marketplace_bids;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'marketplace_bid_events'
    ) then
      alter publication supabase_realtime add table public.marketplace_bid_events;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'marketplace_chat_threads'
    ) then
      alter publication supabase_realtime add table public.marketplace_chat_threads;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'marketplace_chat_messages'
    ) then
      alter publication supabase_realtime add table public.marketplace_chat_messages;
    end if;
  end if;
end
$$;

insert into storage.buckets (id, name, public)
values ('marketplace-images', 'marketplace-images', true)
on conflict (id) do nothing;

drop policy if exists "Marketplace images are publicly accessible" on storage.objects;
create policy "Marketplace images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'marketplace-images');

drop policy if exists "Users can upload marketplace images" on storage.objects;
create policy "Users can upload marketplace images"
  on storage.objects for insert
  with check (
    bucket_id = 'marketplace-images'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update marketplace images" on storage.objects;
create policy "Users can update marketplace images"
  on storage.objects for update
  using (
    bucket_id = 'marketplace-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'marketplace-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete marketplace images" on storage.objects;
create policy "Users can delete marketplace images"
  on storage.objects for delete
  using (
    bucket_id = 'marketplace-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Marketplace Phase 2: transactions, ratings, and report target expansion

do $$
begin
  if to_regclass('public.post_reports') is not null then
    execute 'alter table public.post_reports add column if not exists marketplace_post_id uuid null';

    if to_regclass('public.marketplace_posts') is not null then
      begin
        execute 'alter table public.post_reports add constraint post_reports_marketplace_post_id_fkey foreign key (marketplace_post_id) references public.marketplace_posts(id) on delete cascade';
      exception
        when duplicate_object then
          null;
      end;
    end if;

    begin
      execute 'alter table public.post_reports drop constraint if exists post_reports_target_type_check';
      execute
        'alter table public.post_reports add constraint post_reports_target_type_check check (target_type is null or target_type in (''feed'', ''community'', ''marketplace''))';
    exception
      when others then
        null;
    end;
  end if;
end
$$;

drop policy if exists "Users can update their own marketplace posts" on public.marketplace_posts;
drop policy if exists "Users or admins can update marketplace posts" on public.marketplace_posts;
create policy "Users or admins can update marketplace posts"
  on public.marketplace_posts for update
  using (auth.uid() = seller_user_id or public.is_admin())
  with check (auth.uid() = seller_user_id or public.is_admin());

drop policy if exists "Users can delete their own marketplace posts" on public.marketplace_posts;
drop policy if exists "Users or admins can delete marketplace posts" on public.marketplace_posts;
create policy "Users or admins can delete marketplace posts"
  on public.marketplace_posts for delete
  using (auth.uid() = seller_user_id or public.is_admin());

create table if not exists public.marketplace_transactions (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.marketplace_posts(id) on delete cascade not null,
  seller_user_id uuid references auth.users(id) on delete cascade not null,
  buyer_user_id uuid references auth.users(id) on delete cascade not null,
  accepted_bid_id uuid references public.marketplace_bids(id) on delete cascade not null,
  accepted_bid_amount numeric(12, 2) not null check (accepted_bid_amount > 0),
  accepted_bidder_nickname text not null,
  status text not null default 'pending_meetup' check (status in ('pending_meetup', 'completed', 'cancelled')),
  seller_rating_score int null check (seller_rating_score between 1 and 5),
  seller_rating_note text null,
  buyer_rating_score int null check (buyer_rating_score between 1 and 5),
  buyer_rating_note text null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed_at timestamp with time zone default null,
  cancelled_at timestamp with time zone default null,
  constraint marketplace_transactions_participants_different check (seller_user_id <> buyer_user_id)
);

create index if not exists marketplace_transactions_post_idx
  on public.marketplace_transactions (post_id, created_at desc);
create index if not exists marketplace_transactions_seller_idx
  on public.marketplace_transactions (seller_user_id, created_at desc);
create index if not exists marketplace_transactions_buyer_idx
  on public.marketplace_transactions (buyer_user_id, created_at desc);
create index if not exists marketplace_transactions_status_idx
  on public.marketplace_transactions (status, created_at desc);
create unique index if not exists marketplace_transactions_active_post_unique
  on public.marketplace_transactions (post_id)
  where status in ('pending_meetup', 'completed');

alter table public.marketplace_transactions enable row level security;

drop policy if exists "Marketplace transactions are visible to participants or admin" on public.marketplace_transactions;
create policy "Marketplace transactions are visible to participants or admin"
  on public.marketplace_transactions for select
  using (
    public.is_admin()
    or auth.uid() = seller_user_id
    or auth.uid() = buyer_user_id
  );

drop policy if exists "Seller can create marketplace transactions" on public.marketplace_transactions;
create policy "Seller can create marketplace transactions"
  on public.marketplace_transactions for insert
  with check (
    auth.uid() = seller_user_id
    and seller_user_id <> buyer_user_id
    and exists (
      select 1
      from public.marketplace_posts posts
      where posts.id = post_id
        and posts.seller_user_id = seller_user_id
    )
    and exists (
      select 1
      from public.marketplace_bids bids
      where bids.id = accepted_bid_id
        and bids.post_id = post_id
        and bids.bidder_user_id = buyer_user_id
    )
  );

drop policy if exists "Participants can update marketplace transactions" on public.marketplace_transactions;
create policy "Participants can update marketplace transactions"
  on public.marketplace_transactions for update
  using (
    public.is_admin()
    or auth.uid() = seller_user_id
    or auth.uid() = buyer_user_id
  )
  with check (
    public.is_admin()
    or auth.uid() = seller_user_id
    or auth.uid() = buyer_user_id
  );

drop policy if exists "Admins can delete marketplace transactions" on public.marketplace_transactions;
create policy "Admins can delete marketplace transactions"
  on public.marketplace_transactions for delete
  using (public.is_admin());

create or replace function public.marketplace_guard_transaction_updates()
returns trigger
language plpgsql
as $$
declare
  is_service_role boolean := auth.role() = 'service_role';
begin
  if old.status is distinct from new.status then
    if not (is_service_role or public.is_admin() or auth.uid() = old.seller_user_id) then
      raise exception 'Only seller or admin can change transaction status.';
    end if;

    if new.status = 'completed' and old.completed_at is null then
      new.completed_at = timezone('utc'::text, now());
    end if;

    if new.status = 'cancelled' and old.cancelled_at is null then
      new.cancelled_at = timezone('utc'::text, now());
    end if;
  end if;

  if (
    old.seller_rating_score is distinct from new.seller_rating_score
    or old.seller_rating_note is distinct from new.seller_rating_note
  ) then
    if not (is_service_role or public.is_admin() or auth.uid() = old.buyer_user_id) then
      raise exception 'Only buyer can rate seller.';
    end if;
  end if;

  if (
    old.buyer_rating_score is distinct from new.buyer_rating_score
    or old.buyer_rating_note is distinct from new.buyer_rating_note
  ) then
    if not (is_service_role or public.is_admin() or auth.uid() = old.seller_user_id) then
      raise exception 'Only seller can rate buyer.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_marketplace_transactions_guard on public.marketplace_transactions;
create trigger trg_marketplace_transactions_guard
before update on public.marketplace_transactions
for each row
execute function public.marketplace_guard_transaction_updates();

create or replace function public.marketplace_sync_post_status_from_transaction()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.marketplace_posts
    set
      status = 'reserved',
      updated_at = timezone('utc'::text, now())
    where id = new.post_id;
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if new.status = 'completed' then
      update public.marketplace_posts
      set
        status = 'sold',
        updated_at = timezone('utc'::text, now())
      where id = new.post_id;
    elsif new.status = 'cancelled' then
      update public.marketplace_posts
      set
        status = 'active',
        updated_at = timezone('utc'::text, now())
      where id = new.post_id
        and status <> 'sold';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_marketplace_transactions_sync_post_status on public.marketplace_transactions;
create trigger trg_marketplace_transactions_sync_post_status
after insert or update on public.marketplace_transactions
for each row
execute function public.marketplace_sync_post_status_from_transaction();

create or replace function public.accept_marketplace_bid(
  p_post_id uuid,
  p_bid_id uuid,
  p_seller_user_id uuid
)
returns public.marketplace_transactions
language plpgsql
as $$
declare
  selected_post public.marketplace_posts%rowtype;
  selected_bid public.marketplace_bids%rowtype;
  created_transaction public.marketplace_transactions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if auth.uid() <> p_seller_user_id then
    raise exception 'Only the seller can accept a bid.';
  end if;

  select *
  into selected_post
  from public.marketplace_posts
  where id = p_post_id
  for update;

  if not found then
    raise exception 'Listing not found.';
  end if;

  if selected_post.seller_user_id <> p_seller_user_id then
    raise exception 'Only the listing owner can accept bids.';
  end if;

  if selected_post.status <> 'active' then
    raise exception 'Only active listings can accept bids.';
  end if;

  select *
  into selected_bid
  from public.marketplace_bids
  where id = p_bid_id
    and post_id = p_post_id
  for update;

  if not found then
    raise exception 'Bid not found for this listing.';
  end if;

  if selected_bid.bidder_user_id = p_seller_user_id then
    raise exception 'Seller cannot accept their own bid.';
  end if;

  if exists (
    select 1
    from public.marketplace_transactions transactions
    where transactions.post_id = p_post_id
      and transactions.status in ('pending_meetup', 'completed')
  ) then
    raise exception 'A transaction already exists for this listing.';
  end if;

  insert into public.marketplace_transactions (
    post_id,
    seller_user_id,
    buyer_user_id,
    accepted_bid_id,
    accepted_bid_amount,
    accepted_bidder_nickname,
    status
  ) values (
    p_post_id,
    p_seller_user_id,
    selected_bid.bidder_user_id,
    selected_bid.id,
    selected_bid.amount,
    selected_bid.bidder_nickname,
    'pending_meetup'
  )
  returning * into created_transaction;

  return created_transaction;
end;
$$;

do $$
begin
  if to_regclass('public.marketplace_transactions') is not null then
    execute 'drop trigger if exists trg_marketplace_transactions_updated_at on public.marketplace_transactions';
    execute
      'create trigger trg_marketplace_transactions_updated_at before update on public.marketplace_transactions for each row execute function public.set_activity_row_updated_at()';
  end if;
end
$$;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'marketplace_transactions'
    ) then
      alter publication supabase_realtime add table public.marketplace_transactions;
    end if;
  end if;
end
$$;
