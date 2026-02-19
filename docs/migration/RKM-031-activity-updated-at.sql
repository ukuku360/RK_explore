-- RKM-031: Track edit activity timestamps on post/comment tables

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

update public.posts
set updated_at = coalesce(updated_at, created_at, timezone('utc'::text, now()))
where updated_at is null;

update public.comments
set updated_at = coalesce(updated_at, created_at, timezone('utc'::text, now()))
where updated_at is null;

update public.community_posts
set updated_at = coalesce(updated_at, created_at, timezone('utc'::text, now()))
where updated_at is null;

update public.community_comments
set updated_at = coalesce(updated_at, created_at, timezone('utc'::text, now()))
where updated_at is null;

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

notify pgrst, 'reload schema';
