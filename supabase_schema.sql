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

alter publication supabase_realtime add table public.community_comments;

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
