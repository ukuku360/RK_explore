-- ╔══════════════════════════════════════════════════════════════╗
-- ║  RoomingKos Explores — Supabase Schema                     ║
-- ║  Run this in the Supabase SQL Editor (Dashboard → SQL)     ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ── 1. Posts ──
create table if not exists posts (
  id          uuid primary key default gen_random_uuid(),
  location    text not null,
  author      text not null default 'Tenant',
  user_id     uuid default auth.uid(), -- Tracks the creator
  proposed_date date,
  category    text not null default 'Travel',
  created_at  timestamptz not null default now()
);

-- Ensure user_id exists (if table was created before this column was added)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'posts' and column_name = 'user_id') then
    alter table posts add column user_id uuid default auth.uid();
  end if;
end $$;


-- Ensure category exists (for legacy tables)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'posts' and column_name = 'category') then
    alter table posts add column category text not null default 'Travel';
  end if;
end $$;

-- ── Policy Update ──
-- Only the creator can delete their post
drop policy if exists "Users can delete own posts" on posts;
create policy "Users can delete own posts" on posts for delete using (auth.uid() = user_id);

-- ── 2. Votes (one per user per post) ──
create table if not exists votes (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references posts(id) on delete cascade,
  user_id     text not null,
  created_at  timestamptz not null default now(),
  unique(post_id, user_id)
);

-- ── 3. RSVPs (one per user per post) ──
create table if not exists rsvps (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references posts(id) on delete cascade,
  user_id     text not null,
  created_at  timestamptz not null default now(),
  unique(post_id, user_id)
);

-- ── 4. Comments ──
create table if not exists comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references posts(id) on delete cascade,
  user_id     uuid default auth.uid(),
  author      text not null default 'Tenant',
  text        text not null,
  created_at  timestamptz not null default now()
);

-- Ensure user_id exists on comments (for ownership-aware policies)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'comments' and column_name = 'user_id') then
    alter table comments add column user_id uuid default auth.uid();
  end if;
end $$;

-- ── Indexes for performance ──
create index if not exists idx_votes_post_id    on votes(post_id);
create index if not exists idx_votes_user_id    on votes(user_id);
create index if not exists idx_rsvps_post_id    on rsvps(post_id);
create index if not exists idx_rsvps_user_id    on rsvps(user_id);
create index if not exists idx_comments_post_id on comments(post_id);

-- ── Enable Row Level Security ──
alter table posts    enable row level security;
alter table votes    enable row level security;
alter table rsvps    enable row level security;
alter table comments enable row level security;

-- ── RLS Policies: email-authenticated users only for writes ──
-- Posts
drop policy if exists "Anyone can read posts" on posts;
create policy "Anyone can read posts"    on posts for select using (true);

drop policy if exists "Members can create posts" on posts;
create policy "Members can create posts" on posts for insert to authenticated with check (true);

-- Votes
drop policy if exists "Anyone can read votes" on votes;
create policy "Anyone can read votes"    on votes for select using (true);

drop policy if exists "Anyone can create votes" on votes;
drop policy if exists "Members can create votes" on votes;
create policy "Members can create votes"  on votes for insert to authenticated with check (user_id = auth.uid()::text);

drop policy if exists "Anyone can delete votes" on votes;
drop policy if exists "Members can delete own votes" on votes;
create policy "Members can delete own votes"  on votes for delete to authenticated using (user_id = auth.uid()::text);

-- RSVPs
drop policy if exists "Anyone can read rsvps" on rsvps;
create policy "Anyone can read rsvps"    on rsvps for select using (true);

drop policy if exists "Anyone can create rsvps" on rsvps;
drop policy if exists "Members can create rsvps" on rsvps;
create policy "Members can create rsvps"  on rsvps for insert to authenticated with check (user_id = auth.uid()::text);

drop policy if exists "Anyone can delete rsvps" on rsvps;
drop policy if exists "Members can delete own rsvps" on rsvps;
create policy "Members can delete own rsvps"  on rsvps for delete to authenticated using (user_id = auth.uid()::text);

-- Comments
drop policy if exists "Anyone can read comments" on comments;
create policy "Anyone can read comments"    on comments for select using (true);

drop policy if exists "Anyone can create comments" on comments;
drop policy if exists "Members can create comments" on comments;
create policy "Members can create comments"  on comments for insert to authenticated with check (user_id = auth.uid());

-- ── Enable Realtime ──
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'posts') then
    alter publication supabase_realtime add table posts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'votes') then
    alter publication supabase_realtime add table votes;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'rsvps') then
    alter publication supabase_realtime add table rsvps;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'comments') then
    alter publication supabase_realtime add table comments;
  end if;
end $$;
