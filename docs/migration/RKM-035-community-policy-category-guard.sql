-- RKM-035: Community category enforcement + terms consent guard

create or replace function public.is_valid_community_category(input_category text)
returns boolean
language sql
immutable
as $$
  select input_category = any (
    array[
      'general',
      'free_stuff',
      'laundry_done',
      'ideas',
      'lost_and_found',
      'help_needed',
      'noise_alert',
      'marketplace'
    ]::text[]
  );
$$;

create or replace function public.are_valid_community_categories(input_categories text[])
returns boolean
language plpgsql
immutable
as $$
declare
  category_value text;
begin
  if input_categories is null or coalesce(array_length(input_categories, 1), 0) = 0 then
    return false;
  end if;

  foreach category_value in array input_categories loop
    if not public.is_valid_community_category(category_value) then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

alter table if exists public.community_posts
  add column if not exists category text not null default 'general';

alter table if exists public.community_posts
  drop constraint if exists community_posts_category_check;

alter table if exists public.community_posts
  add constraint community_posts_category_check
  check (public.is_valid_community_category(category));

create table if not exists public.community_user_category_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  allowed_categories text[] not null default array[
    'general',
    'free_stuff',
    'laundry_done',
    'ideas',
    'lost_and_found',
    'help_needed',
    'noise_alert',
    'marketplace'
  ]::text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.community_user_category_settings enable row level security;

alter table if exists public.community_user_category_settings
  drop constraint if exists community_user_category_settings_allowed_categories_check;

alter table if exists public.community_user_category_settings
  add constraint community_user_category_settings_allowed_categories_check
  check (public.are_valid_community_categories(allowed_categories));

drop policy if exists "Community category settings are viewable by owner" on public.community_user_category_settings;
create policy "Community category settings are viewable by owner"
  on public.community_user_category_settings for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own community category settings" on public.community_user_category_settings;
create policy "Users can insert their own community category settings"
  on public.community_user_category_settings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own community category settings" on public.community_user_category_settings;
create policy "Users can update their own community category settings"
  on public.community_user_category_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own community category settings" on public.community_user_category_settings;
create policy "Users can delete their own community category settings"
  on public.community_user_category_settings for delete
  using (auth.uid() = user_id);

drop trigger if exists trg_community_user_category_settings_updated_at on public.community_user_category_settings;
create trigger trg_community_user_category_settings_updated_at
before update on public.community_user_category_settings
for each row
execute function public.set_activity_row_updated_at();

create table if not exists public.community_policy_versions (
  version text primary key,
  title text not null,
  summary text not null,
  terms_markdown text not null,
  is_active boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create unique index if not exists community_policy_versions_active_idx
  on public.community_policy_versions (is_active)
  where is_active = true;

alter table public.community_policy_versions enable row level security;

drop policy if exists "Community policy versions are viewable by everyone" on public.community_policy_versions;
create policy "Community policy versions are viewable by everyone"
  on public.community_policy_versions for select
  using (true);

create table if not exists public.community_policy_consents (
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_version text not null references public.community_policy_versions(version) on delete cascade,
  consented_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, policy_version)
);

alter table public.community_policy_consents enable row level security;

drop policy if exists "Community policy consents are viewable by owner" on public.community_policy_consents;
create policy "Community policy consents are viewable by owner"
  on public.community_policy_consents for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own policy consents" on public.community_policy_consents;
create policy "Users can insert their own policy consents"
  on public.community_policy_consents for insert
  with check (auth.uid() = user_id);

insert into public.community_policy_versions (version, title, summary, terms_markdown, is_active)
values (
  '2026-02-23-v1',
  'Community Terms & Conditions v1',
  'Posts must match your selected category and stay within resident community scope.',
  $$1. Purpose
- The Community Board is for resident updates, requests, and neighborhood coordination.

2. Category compliance
- Every post must be written under one predefined category.
- The post content must be reasonably related to the selected category.

3. Scope of use
- Only categories enabled for your account can be used to publish posts.
- Repeated off-category posting may result in post restriction.

4. Prohibited behavior
- Defamation, harassment, and inflammatory rumor-spreading are prohibited.
- Repetitive complaint amplification outside category scope is prohibited.

5. Complaint routing
- Property/contract/operations complaints must use the official support channel, not this board.

6. Moderation action
- Violating posts may be hidden or deleted without prior notice.
- Repeated violations can lead to posting restriction.

7. Consent record
- By posting, you agree to the latest Community Terms and consent is stored for compliance.$$,
  true
)
on conflict (version) do update
set
  title = excluded.title,
  summary = excluded.summary,
  terms_markdown = excluded.terms_markdown;

do $$
begin
  if not exists (select 1 from public.community_policy_versions where is_active = true) then
    update public.community_policy_versions
    set is_active = (version = '2026-02-23-v1');
  end if;
end
$$;

create or replace function public.enforce_community_post_policy()
returns trigger
language plpgsql
as $$
declare
  allowed_categories text[];
  active_policy_version text;
begin
  if new.user_id is null then
    raise exception 'Community post user is required.'
      using errcode = 'P0001', detail = 'COMMUNITY_USER_REQUIRED';
  end if;

  if not public.is_valid_community_category(new.category) then
    raise exception 'Invalid community category.'
      using errcode = 'P0001', detail = 'COMMUNITY_CATEGORY_INVALID';
  end if;

  select settings.allowed_categories
  into allowed_categories
  from public.community_user_category_settings settings
  where settings.user_id = new.user_id;

  if allowed_categories is null or coalesce(array_length(allowed_categories, 1), 0) = 0 then
    allowed_categories := array[
      'general',
      'free_stuff',
      'laundry_done',
      'ideas',
      'lost_and_found',
      'help_needed',
      'noise_alert',
      'marketplace'
    ]::text[];
  end if;

  if not (new.category = any (allowed_categories)) then
    raise exception 'Selected category is not enabled for your account.'
      using errcode = 'P0001', detail = 'COMMUNITY_CATEGORY_NOT_ALLOWED';
  end if;

  select policy.version
  into active_policy_version
  from public.community_policy_versions policy
  where policy.is_active = true
  order by policy.created_at desc
  limit 1;

  if active_policy_version is not null
    and not exists (
      select 1
      from public.community_policy_consents consent
      where consent.user_id = new.user_id
        and consent.policy_version = active_policy_version
    )
  then
    raise exception 'Accept Community Terms before posting.'
      using errcode = 'P0001', detail = 'COMMUNITY_TERMS_CONSENT_REQUIRED';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_community_posts_enforce_policy on public.community_posts;
create trigger trg_community_posts_enforce_policy
before insert or update on public.community_posts
for each row
execute function public.enforce_community_post_policy();

notify pgrst, 'reload schema';
