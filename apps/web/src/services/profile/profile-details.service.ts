import type { ProfileDetails } from '../../types/domain'
import { supabaseClient } from '../supabase/client'
import { throwIfPostgrestError } from '../supabase/errors'

interface UserProfileDetailsRecord extends ProfileDetails {
  user_id: string
}

export async function getUserProfileDetails(userId: string): Promise<ProfileDetails> {
  const { data, error } = await supabaseClient
    .from('user_profile_details')
    .select('tagline, bio, location, occupations, hobbies, links')
    .eq('user_id', userId)
    .maybeSingle()

  throwIfPostgrestError(error)

  if (!data) {
    return {
      tagline: '',
      bio: '',
      location: '',
      occupations: '',
      hobbies: '',
      links: '',
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
    .select('tagline, bio, location, occupations, hobbies, links')
    .single()

  throwIfPostgrestError(error)

  return data as ProfileDetails
}
