-- RKM-037: Feed RLS lockdown for resident launch
-- - Reset policies on feed tables to eliminate anonymous data access
-- - Keep owner flows working, and keep admin moderation paths if is_admin() exists

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
    execute 'create policy "Users can insert their own votes" on public.votes for insert with check (auth.uid() = user_id)';
    execute 'create policy "Users can delete their own votes" on public.votes for delete using (auth.uid() = user_id)';
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
    execute 'create policy "Users can insert their own rsvps" on public.rsvps for insert with check (auth.uid() = user_id)';
    execute 'create policy "Users can delete their own rsvps" on public.rsvps for delete using (auth.uid() = user_id)';
  end if;
end
$$;

notify pgrst, 'reload schema';
