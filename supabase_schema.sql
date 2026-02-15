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
