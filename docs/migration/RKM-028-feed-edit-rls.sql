-- RKM-028: Add UPDATE policies for feed posts and comments
-- Run this in Supabase SQL editor to enable edit functionality.

-- Posts: owners can update their own posts
drop policy if exists "Users can update their own posts" on public.posts;
create policy "Users can update their own posts"
  on public.posts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Comments: owners can update their own comments
drop policy if exists "Users can update their own comments" on public.comments;
create policy "Users can update their own comments"
  on public.comments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
