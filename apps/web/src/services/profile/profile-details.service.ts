import type { PostgrestError } from '@supabase/supabase-js'
import type { ProfileDetails } from '../../types/domain'
import { supabaseClient } from '../supabase/client'
import { throwIfPostgrestError } from '../supabase/errors'

interface UserProfileDetailsRecord extends ProfileDetails {
  user_id: string
}

type UserProfileDetailsNoSocialRecord = Omit<UserProfileDetailsRecord, 'instagram_url' | 'linkedin_url'>

type LegacyUserProfileDetailsRecord = {
  user_id: string
  tagline: string
  bio: string
  location: string
  occupations: string
  hobbies: string
  links: string
  avatar_url: string | null
}

type UserProfileAvatarRecord = {
  user_id: string
  avatar_url: string | null
}

const PROFILE_DETAILS_SELECT_FULL =
  'tagline, bio, location, country, city, uni, major, instagram_url, linkedin_url, occupations, hobbies, links, avatar_url'
const PROFILE_DETAILS_SELECT_WITHOUT_SOCIAL =
  'tagline, bio, location, country, city, uni, major, occupations, hobbies, links, avatar_url'
const PROFILE_DETAILS_SELECT_LEGACY = 'tagline, bio, location, occupations, hobbies, links, avatar_url'

function getDefaultProfileDetails(): ProfileDetails {
  return {
    tagline: '',
    bio: '',
    location: '',
    country: '',
    city: '',
    uni: '',
    major: '',
    instagram_url: '',
    linkedin_url: '',
    occupations: '',
    hobbies: '',
    links: '',
    avatar_url: null,
  }
}

function withSocialDefaults(
  record: Omit<ProfileDetails, 'instagram_url' | 'linkedin_url'>,
): ProfileDetails {
  return {
    ...record,
    instagram_url: '',
    linkedin_url: '',
  }
}

function withLegacyDefaults(
  record: Omit<LegacyUserProfileDetailsRecord, 'user_id'>,
): ProfileDetails {
  return {
    ...record,
    country: '',
    city: '',
    uni: '',
    major: '',
    instagram_url: '',
    linkedin_url: '',
  }
}

function isMissingNewProfileColumnError(error: PostgrestError | null): boolean {
  if (!error) return false

  if (error.code === '42703' || error.code === 'PGRST204') {
    return true
  }

  const message = error.message.toLowerCase()
  return ['country', 'city', 'uni', 'major', 'instagram_url', 'linkedin_url'].some((column) =>
    message.includes(column),
  )
}

function normalizeFullProfileDetails(data: unknown): ProfileDetails {
  if (!data) return getDefaultProfileDetails()
  return data as ProfileDetails
}

function normalizeNoSocialProfileDetails(data: unknown): ProfileDetails {
  if (!data) return getDefaultProfileDetails()
  return withSocialDefaults(data as Omit<ProfileDetails, 'instagram_url' | 'linkedin_url'>)
}

function normalizeLegacyProfileDetails(data: unknown): ProfileDetails {
  if (!data) return getDefaultProfileDetails()
  return withLegacyDefaults(data as Omit<LegacyUserProfileDetailsRecord, 'user_id'>)
}

export async function getUserProfileDetails(userId: string): Promise<ProfileDetails> {
  const readAttempts: Array<{
    select: string
    normalize: (data: unknown) => ProfileDetails
  }> = [
    {
      select: PROFILE_DETAILS_SELECT_FULL,
      normalize: normalizeFullProfileDetails,
    },
    {
      select: PROFILE_DETAILS_SELECT_WITHOUT_SOCIAL,
      normalize: normalizeNoSocialProfileDetails,
    },
    {
      select: PROFILE_DETAILS_SELECT_LEGACY,
      normalize: normalizeLegacyProfileDetails,
    },
  ]

  let lastMissingColumnError: PostgrestError | null = null

  for (const attempt of readAttempts) {
    const { data, error } = await supabaseClient
      .from('user_profile_details')
      .select(attempt.select)
      .eq('user_id', userId)
      .maybeSingle()

    if (!error) {
      return attempt.normalize(data)
    }

    if (!isMissingNewProfileColumnError(error)) {
      throwIfPostgrestError(error)
    }

    lastMissingColumnError = error
  }

  throwIfPostgrestError(lastMissingColumnError)
  return getDefaultProfileDetails()
}

export async function upsertUserProfileDetails(
  userId: string,
  details: ProfileDetails,
): Promise<ProfileDetails> {
  const fullPayload: UserProfileDetailsRecord = {
    user_id: userId,
    ...details,
  }

  const noSocialPayload: UserProfileDetailsNoSocialRecord = {
    user_id: userId,
    tagline: details.tagline,
    bio: details.bio,
    location: details.location,
    country: details.country,
    city: details.city,
    uni: details.uni,
    major: details.major,
    occupations: details.occupations,
    hobbies: details.hobbies,
    links: details.links,
    avatar_url: details.avatar_url,
  }

  const legacyPayload: LegacyUserProfileDetailsRecord = {
    user_id: userId,
    tagline: details.tagline,
    bio: details.bio,
    location: details.location,
    occupations: details.occupations,
    hobbies: details.hobbies,
    links: details.links,
    avatar_url: details.avatar_url,
  }

  const writeAttempts: Array<{
    payload: Record<string, unknown>
    select: string
    normalize: (data: unknown) => ProfileDetails
  }> = [
    {
      payload: fullPayload,
      select: PROFILE_DETAILS_SELECT_FULL,
      normalize: normalizeFullProfileDetails,
    },
    {
      payload: noSocialPayload,
      select: PROFILE_DETAILS_SELECT_WITHOUT_SOCIAL,
      normalize: normalizeNoSocialProfileDetails,
    },
    {
      payload: legacyPayload,
      select: PROFILE_DETAILS_SELECT_LEGACY,
      normalize: normalizeLegacyProfileDetails,
    },
  ]

  let lastMissingColumnError: PostgrestError | null = null

  for (const attempt of writeAttempts) {
    const { data, error } = await supabaseClient
      .from('user_profile_details')
      .upsert(attempt.payload, { onConflict: 'user_id' })
      .select(attempt.select)
      .single()

    if (!error) {
      return attempt.normalize(data)
    }

    if (!isMissingNewProfileColumnError(error)) {
      throwIfPostgrestError(error)
    }

    lastMissingColumnError = error
  }

  throwIfPostgrestError(lastMissingColumnError)
  return getDefaultProfileDetails()
}

export async function listUserProfileAvatars(userIds: string[]): Promise<Record<string, string | null>> {
  if (userIds.length === 0) return {}

  const uniqueUserIds = [...new Set(userIds)]
  const { data, error } = await supabaseClient
    .from('user_profile_details')
    .select('user_id, avatar_url')
    .in('user_id', uniqueUserIds)

  throwIfPostgrestError(error)

  const avatarByUserId: Record<string, string | null> = {}
  for (const userId of uniqueUserIds) {
    avatarByUserId[userId] = null
  }

  for (const row of (data ?? []) as UserProfileAvatarRecord[]) {
    avatarByUserId[row.user_id] = row.avatar_url
  }

  return avatarByUserId
}
