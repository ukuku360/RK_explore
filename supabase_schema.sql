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
