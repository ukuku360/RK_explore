-- RKM-029: Add social link columns to user_profile_details

alter table if exists public.user_profile_details
  add column if not exists instagram_url text;

alter table if exists public.user_profile_details
  add column if not exists linkedin_url text;

alter table if exists public.user_profile_details
  alter column instagram_url set default '';

alter table if exists public.user_profile_details
  alter column linkedin_url set default '';

update public.user_profile_details
set instagram_url = coalesce(instagram_url, ''),
    linkedin_url = coalesce(linkedin_url, '')
where instagram_url is null
   or linkedin_url is null;

alter table if exists public.user_profile_details
  alter column instagram_url set not null;

alter table if exists public.user_profile_details
  alter column linkedin_url set not null;

notify pgrst, 'reload schema';
