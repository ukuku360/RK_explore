-- RKM-028: Add profile details fields for profile sections

alter table if exists public.user_profile_details
  add column if not exists country text;

alter table if exists public.user_profile_details
  add column if not exists city text;

alter table if exists public.user_profile_details
  add column if not exists uni text;

alter table if exists public.user_profile_details
  add column if not exists major text;

alter table if exists public.user_profile_details
  alter column country set default '';

alter table if exists public.user_profile_details
  alter column city set default '';

alter table if exists public.user_profile_details
  alter column uni set default '';

alter table if exists public.user_profile_details
  alter column major set default '';

update public.user_profile_details
set country = '', city = '', uni = '', major = ''
where country is null
  or city is null
  or uni is null
  or major is null;

alter table if exists public.user_profile_details
  alter column country set not null;

alter table if exists public.user_profile_details
  alter column city set not null;

alter table if exists public.user_profile_details
  alter column uni set not null;

alter table if exists public.user_profile_details
  alter column major set not null;
