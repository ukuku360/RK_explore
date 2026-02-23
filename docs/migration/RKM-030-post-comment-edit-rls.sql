-- RKM-030: Enable own-row update policies for post/comment edit flows

alter table if exists public.posts enable row level security;
alter table if exists public.comments enable row level security;
alter table if exists public.community_posts enable row level security;
alter table if exists public.community_comments enable row level security;

drop policy if exists "Users can update their own posts" on public.posts;
create policy "Users can update their own posts"
  on public.posts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own comments" on public.comments;
create policy "Users can update their own comments"
  on public.comments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own community posts" on public.community_posts;
create policy "Users can update their own community posts"
  on public.community_posts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own community comments" on public.community_comments;
create policy "Users can update their own community comments"
  on public.community_comments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
