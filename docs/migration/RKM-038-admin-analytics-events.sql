-- RKM-038: Admin activation metrics event storage

create table if not exists public.analytics_events (
  id uuid default gen_random_uuid() primary key,
  event_name text not null check (char_length(trim(event_name)) > 0),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'member')),
  post_id uuid null,
  surface text not null default 'unknown',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at desc);
create index if not exists analytics_events_event_name_idx
  on public.analytics_events (event_name, created_at desc);
create index if not exists analytics_events_user_id_idx
  on public.analytics_events (user_id, created_at desc);

alter table public.analytics_events enable row level security;

drop policy if exists "Users can insert their own analytics events" on public.analytics_events;
create policy "Users can insert their own analytics events"
  on public.analytics_events for insert
  with check (auth.uid() = user_id);

drop policy if exists "Admins can read analytics events" on public.analytics_events;
create policy "Admins can read analytics events"
  on public.analytics_events for select
  using (public.is_admin());
