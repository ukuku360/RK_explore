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

