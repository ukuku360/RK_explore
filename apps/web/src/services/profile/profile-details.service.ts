import type { ProfileDetails } from '../../types/domain'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabaseClient } from '../supabase/client'
import { throwIfPostgrestError } from '../supabase/errors'

interface UserProfileDetailsRecord extends ProfileDetails {
  user_id: string
}

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

const PROFILE_DETAILS_SELECT =
  'tagline, bio, location, country, city, uni, major, occupations, hobbies, links, avatar_url'
const LEGACY_PROFILE_DETAILS_SELECT = 'tagline, bio, location, occupations, hobbies, links, avatar_url'

function getDefaultProfileDetails(): ProfileDetails {
  return {
    tagline: '',
    bio: '',
    location: '',
    country: '',
    city: '',
    uni: '',
    major: '',
    occupations: '',
    hobbies: '',
    links: '',
    avatar_url: null,
  }
}

function withExtraProfileFields(
  legacy: Omit<LegacyUserProfileDetailsRecord, 'user_id'>,
): ProfileDetails {
  return {
    ...legacy,
    country: '',
    city: '',
    uni: '',
    major: '',
  }
}

function isMissingNewProfileColumnError(error: PostgrestError | null): boolean {
  if (!error) return false

  if (error.code === '42703' || error.code === 'PGRST204') {
    return true
  }

  const message = error.message.toLowerCase()
  return ['country', 'city', 'uni', 'major'].some((column) => message.includes(column))
}

export async function getUserProfileDetails(userId: string): Promise<ProfileDetails> {
  const { data, error } = await supabaseClient
    .from('user_profile_details')
    .select(PROFILE_DETAILS_SELECT)
    .eq('user_id', userId)
    .maybeSingle()

  // Backward-compatible read path while some environments still have the old schema.
  if (isMissingNewProfileColumnError(error)) {
    const legacyResult = await supabaseClient
      .from('user_profile_details')
      .select(LEGACY_PROFILE_DETAILS_SELECT)
      .eq('user_id', userId)
      .maybeSingle()

    throwIfPostgrestError(legacyResult.error)
    if (!legacyResult.data) return getDefaultProfileDetails()
    return withExtraProfileFields(legacyResult.data as Omit<LegacyUserProfileDetailsRecord, 'user_id'>)
  }

  throwIfPostgrestError(error)

  if (!data) return getDefaultProfileDetails()

  return data as ProfileDetails
}

export async function upsertUserProfileDetails(
  userId: string,
  details: ProfileDetails,
): Promise<ProfileDetails> {
  const payload: UserProfileDetailsRecord = {
    user_id: userId,
    ...details,
  }

  const { data, error } = await supabaseClient
    .from('user_profile_details')
    .upsert(payload, { onConflict: 'user_id' })
    .select(PROFILE_DETAILS_SELECT)
    .single()

  // Backward-compatible write path while old schema is still deployed.
  if (isMissingNewProfileColumnError(error)) {
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

    const legacyResult = await supabaseClient
      .from('user_profile_details')
      .upsert(legacyPayload, { onConflict: 'user_id' })
      .select(LEGACY_PROFILE_DETAILS_SELECT)
      .single()

    throwIfPostgrestError(legacyResult.error)
    return withExtraProfileFields(legacyResult.data as Omit<LegacyUserProfileDetailsRecord, 'user_id'>)
  }

  throwIfPostgrestError(error)

  return data as ProfileDetails
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
