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
  created_at  timestamptz not null default now()
);

-- Ensure user_id exists (if table was created before this column was added)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'posts' and column_name = 'user_id') then
    alter table posts add column user_id uuid default auth.uid();
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
  author      text not null default 'Tenant',
  text        text not null,
  created_at  timestamptz not null default now()
);

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

-- ── RLS Policies: allow anonymous read/write ──
-- Posts
drop policy if exists "Anyone can read posts" on posts;
create policy "Anyone can read posts"    on posts for select using (true);

drop policy if exists "Members can create posts" on posts;
create policy "Members can create posts" on posts for insert to authenticated with check (true);

-- Votes
drop policy if exists "Anyone can read votes" on votes;
create policy "Anyone can read votes"    on votes for select using (true);

drop policy if exists "Anyone can create votes" on votes;
create policy "Anyone can create votes"  on votes for insert with check (true);

drop policy if exists "Anyone can delete votes" on votes;
create policy "Anyone can delete votes"  on votes for delete using (true);

-- RSVPs
drop policy if exists "Anyone can read rsvps" on rsvps;
create policy "Anyone can read rsvps"    on rsvps for select using (true);

drop policy if exists "Anyone can create rsvps" on rsvps;
create policy "Anyone can create rsvps"  on rsvps for insert with check (true);

drop policy if exists "Anyone can delete rsvps" on rsvps;
create policy "Anyone can delete rsvps"  on rsvps for delete using (true);

-- Comments
drop policy if exists "Anyone can read comments" on comments;
create policy "Anyone can read comments"    on comments for select using (true);

drop policy if exists "Anyone can create comments" on comments;
create policy "Anyone can create comments"  on comments for insert with check (true);

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
