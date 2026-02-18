import type { ProfileDetails } from '../../types/domain'
import { supabaseClient } from '../supabase/client'
import { throwIfPostgrestError } from '../supabase/errors'

interface UserProfileDetailsRecord extends ProfileDetails {
  user_id: string
}

type UserProfileAvatarRecord = {
  user_id: string
  avatar_url: string | null
}

export async function getUserProfileDetails(userId: string): Promise<ProfileDetails> {
  const { data, error } = await supabaseClient
    .from('user_profile_details')
    .select('tagline, bio, location, country, city, uni, major, occupations, hobbies, links, avatar_url')
    .eq('user_id', userId)
    .maybeSingle()

  throwIfPostgrestError(error)

  if (!data) {
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
    .select('tagline, bio, location, country, city, uni, major, occupations, hobbies, links, avatar_url')
    .single()

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
