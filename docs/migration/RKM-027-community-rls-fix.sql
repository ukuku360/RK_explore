-- RKM-027: Community post persistence after refresh (RLS hardening)
-- Run this in Supabase SQL editor for existing projects.

alter table if exists public.community_posts enable row level security;
alter table if exists public.community_likes enable row level security;
alter table if exists public.community_comments enable row level security;

-- Recreate policies so existing environments are guaranteed to allow read-after-write.
drop policy if exists "Community posts are viewable by everyone" on public.community_posts;
drop policy if exists "Users can insert their own community posts" on public.community_posts;
drop policy if exists "Users can delete their own community posts" on public.community_posts;

create policy "Community posts are viewable by everyone"
  on public.community_posts for select
  using (true);

create policy "Users can insert their own community posts"
  on public.community_posts for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own community posts"
  on public.community_posts for delete
  using (auth.uid() = user_id);


drop policy if exists "Community likes are viewable by everyone" on public.community_likes;
drop policy if exists "Users can insert their own likes" on public.community_likes;
drop policy if exists "Users can delete their own likes" on public.community_likes;

create policy "Community likes are viewable by everyone"
  on public.community_likes for select
  using (true);

create policy "Users can insert their own likes"
  on public.community_likes for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own likes"
  on public.community_likes for delete
  using (auth.uid() = user_id);


drop policy if exists "Community comments are viewable by everyone" on public.community_comments;
drop policy if exists "Users can insert their own comments" on public.community_comments;
drop policy if exists "Users can delete their own comments" on public.community_comments;

create policy "Community comments are viewable by everyone"
  on public.community_comments for select
  using (true);

create policy "Users can insert their own comments"
  on public.community_comments for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own comments"
  on public.community_comments for delete
  using (auth.uid() = user_id);
