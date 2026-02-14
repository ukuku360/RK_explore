-- ╔══════════════════════════════════════════════════════════════╗
-- ║  RoomingKos Explores - Supabase Schema                     ║
-- ║  Run this in the Supabase SQL Editor (Dashboard -> SQL)    ║
-- ╚══════════════════════════════════════════════════════════════╝

-- -----------------------------------------------------------------
-- 0) Core posts table
-- -----------------------------------------------------------------
create table if not exists posts (
  id              uuid primary key default gen_random_uuid(),
  location        text not null,
  author          text not null default 'Tenant',
  user_id         uuid not null default auth.uid(),
  proposed_date   date,
  category        text not null default 'Travel',
  status          text not null default 'proposed',
  capacity        integer not null default 10,
  meetup_place    text,
  meeting_time    time,
  estimated_cost  integer,
  prep_notes      text,
  rsvp_deadline   timestamptz,
  is_hidden       boolean not null default false,
  hidden_reason   text,
  hidden_by       uuid,
  hidden_at       timestamptz,
  created_at      timestamptz not null default now()
);

-- Legacy compatibility: add columns when missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'user_id') THEN
    ALTER TABLE posts ADD COLUMN user_id uuid NOT NULL DEFAULT auth.uid();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'status') THEN
    ALTER TABLE posts ADD COLUMN status text NOT NULL DEFAULT 'proposed';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'category') THEN
    ALTER TABLE posts ADD COLUMN category text NOT NULL DEFAULT 'Travel';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'capacity') THEN
    ALTER TABLE posts ADD COLUMN capacity integer NOT NULL DEFAULT 10;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'meetup_place') THEN
    ALTER TABLE posts ADD COLUMN meetup_place text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'meeting_time') THEN
    ALTER TABLE posts ADD COLUMN meeting_time time;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'estimated_cost') THEN
    ALTER TABLE posts ADD COLUMN estimated_cost integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'prep_notes') THEN
    ALTER TABLE posts ADD COLUMN prep_notes text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'rsvp_deadline') THEN
    ALTER TABLE posts ADD COLUMN rsvp_deadline timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'is_hidden') THEN
    ALTER TABLE posts ADD COLUMN is_hidden boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'hidden_reason') THEN
    ALTER TABLE posts ADD COLUMN hidden_reason text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'hidden_by') THEN
    ALTER TABLE posts ADD COLUMN hidden_by uuid;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'hidden_at') THEN
    ALTER TABLE posts ADD COLUMN hidden_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_capacity_positive') THEN
    ALTER TABLE posts ADD CONSTRAINT posts_capacity_positive CHECK (capacity > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_estimated_cost_non_negative') THEN
    ALTER TABLE posts ADD CONSTRAINT posts_estimated_cost_non_negative CHECK (estimated_cost IS NULL OR estimated_cost >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_status_valid') THEN
    ALTER TABLE posts ADD CONSTRAINT posts_status_valid CHECK (status IN ('proposed', 'confirmed'));
  END IF;
END $$;

-- -----------------------------------------------------------------
-- 1) Votes (one per user per post)
-- -----------------------------------------------------------------
create table if not exists votes (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references posts(id) on delete cascade,
  user_id     text not null,
  created_at  timestamptz not null default now(),
  unique(post_id, user_id)
);

-- -----------------------------------------------------------------
-- 2) RSVPs (one per user per post)
-- -----------------------------------------------------------------
create table if not exists rsvps (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references posts(id) on delete cascade,
  user_id     text not null,
  created_at  timestamptz not null default now(),
  unique(post_id, user_id)
);

-- -----------------------------------------------------------------
-- 3) Comments
-- -----------------------------------------------------------------
create table if not exists comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references posts(id) on delete cascade,
  user_id     uuid default auth.uid(),
  author      text not null default 'Tenant',
  text        text not null,
  created_at  timestamptz not null default now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'comments' AND column_name = 'user_id') THEN
    ALTER TABLE comments ADD COLUMN user_id uuid default auth.uid();
  END IF;
END $$;

-- -----------------------------------------------------------------
-- 4) Reports (submitted by users)
-- -----------------------------------------------------------------
create table if not exists post_reports (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid not null references posts(id) on delete cascade,
  reporter_user_id  uuid not null default auth.uid(),
  reporter_email    text not null,
  reason            text not null,
  status            text not null default 'open',
  created_at        timestamptz not null default now(),
  reviewed_by       uuid,
  reviewed_at       timestamptz
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_reports_status_valid') THEN
    ALTER TABLE post_reports ADD CONSTRAINT post_reports_status_valid CHECK (status IN ('open', 'dismissed', 'actioned'));
  END IF;
END $$;

-- -----------------------------------------------------------------
-- 5) Admin action logs
-- -----------------------------------------------------------------
create table if not exists admin_action_logs (
  id             uuid primary key default gen_random_uuid(),
  post_id        uuid references posts(id) on delete set null,
  report_id      uuid references post_reports(id) on delete set null,
  action         text not null,
  reason         text not null,
  admin_user_id  uuid not null default auth.uid(),
  admin_email    text not null,
  created_at     timestamptz not null default now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_action_logs_action_valid') THEN
    ALTER TABLE admin_action_logs ADD CONSTRAINT admin_action_logs_action_valid CHECK (action IN ('hide', 'unhide', 'delete', 'dismiss_report'));
  END IF;
END $$;

-- -----------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------
create index if not exists idx_posts_created_at         on posts(created_at desc);
create index if not exists idx_posts_is_hidden          on posts(is_hidden);
create index if not exists idx_votes_post_id            on votes(post_id);
create index if not exists idx_votes_user_id            on votes(user_id);
create index if not exists idx_rsvps_post_id            on rsvps(post_id);
create index if not exists idx_rsvps_user_id            on rsvps(user_id);
create index if not exists idx_comments_post_id         on comments(post_id);
create index if not exists idx_post_reports_post_id     on post_reports(post_id);
create index if not exists idx_post_reports_status      on post_reports(status);
create index if not exists idx_post_reports_created_at  on post_reports(created_at desc);
create index if not exists idx_admin_logs_created_at    on admin_action_logs(created_at desc);

-- -----------------------------------------------------------------
-- Enable RLS
-- -----------------------------------------------------------------
alter table posts             enable row level security;
alter table votes             enable row level security;
alter table rsvps             enable row level security;
alter table comments          enable row level security;
alter table post_reports      enable row level security;
alter table admin_action_logs enable row level security;

-- -----------------------------------------------------------------
-- Policies - Posts
-- -----------------------------------------------------------------
drop policy if exists "Anyone can read posts" on posts;
drop policy if exists "Members can read visible posts" on posts;
create policy "Members can read visible posts"
on posts
for select
using (
  is_hidden = false
  OR auth.uid() = user_id
  OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'swanston@roomingkos.com'
);

drop policy if exists "Members can create posts" on posts;
drop policy if exists "Anyone can create posts" on posts;
create policy "Members can create posts"
on posts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own posts" on posts;
create policy "Users can update own posts"
on posts
for update
to authenticated
using (
  auth.uid() = user_id
  OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'swanston@roomingkos.com'
)
with check (
  auth.uid() = user_id
  OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'swanston@roomingkos.com'
);

drop policy if exists "Users can delete own posts" on posts;
create policy "Users can delete own posts"
on posts
for delete
to authenticated
using (
  auth.uid() = user_id
  OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'swanston@roomingkos.com'
);

-- -----------------------------------------------------------------
-- Policies - Votes
-- -----------------------------------------------------------------
drop policy if exists "Anyone can read votes" on votes;
create policy "Anyone can read votes"
on votes
for select
using (true);

drop policy if exists "Anyone can create votes" on votes;
drop policy if exists "Members can create votes" on votes;
create policy "Members can create votes"
on votes
for insert
to authenticated
with check (user_id = auth.uid()::text);

drop policy if exists "Anyone can delete votes" on votes;
drop policy if exists "Members can delete own votes" on votes;
create policy "Members can delete own votes"
on votes
for delete
to authenticated
using (user_id = auth.uid()::text);

-- -----------------------------------------------------------------
-- Policies - RSVPs
-- -----------------------------------------------------------------
drop policy if exists "Anyone can read rsvps" on rsvps;
create policy "Anyone can read rsvps"
on rsvps
for select
using (true);

drop policy if exists "Anyone can create rsvps" on rsvps;
drop policy if exists "Members can create rsvps" on rsvps;
create policy "Members can create rsvps"
on rsvps
for insert
to authenticated
with check (user_id = auth.uid()::text);

drop policy if exists "Anyone can delete rsvps" on rsvps;
drop policy if exists "Members can delete own rsvps" on rsvps;
create policy "Members can delete own rsvps"
on rsvps
for delete
to authenticated
using (user_id = auth.uid()::text);

-- -----------------------------------------------------------------
-- Policies - Comments
-- -----------------------------------------------------------------
drop policy if exists "Anyone can read comments" on comments;
create policy "Anyone can read comments"
on comments
for select
using (true);

drop policy if exists "Anyone can create comments" on comments;
drop policy if exists "Members can create comments" on comments;
create policy "Members can create comments"
on comments
for insert
to authenticated
with check (user_id = auth.uid());

-- -----------------------------------------------------------------
-- Policies - Reports
-- -----------------------------------------------------------------
drop policy if exists "Members can read own reports or admin" on post_reports;
create policy "Members can read own reports or admin"
on post_reports
for select
to authenticated
using (
  reporter_user_id = auth.uid()
  OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'swanston@roomingkos.com'
);

drop policy if exists "Members can create reports" on post_reports;
create policy "Members can create reports"
on post_reports
for insert
to authenticated
with check (
  reporter_user_id = auth.uid()
  AND char_length(trim(reason)) >= 5
);

drop policy if exists "Admins can review reports" on post_reports;
create policy "Admins can review reports"
on post_reports
for update
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'swanston@roomingkos.com'
)
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'swanston@roomingkos.com'
);

-- -----------------------------------------------------------------
-- Policies - Admin logs
-- -----------------------------------------------------------------
drop policy if exists "Admins can read moderation logs" on admin_action_logs;
create policy "Admins can read moderation logs"
on admin_action_logs
for select
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'swanston@roomingkos.com'
);

drop policy if exists "Admins can create moderation logs" on admin_action_logs;
create policy "Admins can create moderation logs"
on admin_action_logs
for insert
to authenticated
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'swanston@roomingkos.com'
  AND admin_user_id = auth.uid()
);

-- -----------------------------------------------------------------
-- Enable realtime subscriptions for all app tables
-- -----------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'posts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE posts;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'votes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE votes;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'rsvps') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rsvps;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'comments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE comments;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'post_reports') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE post_reports;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'admin_action_logs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE admin_action_logs;
  END IF;
END $$;
