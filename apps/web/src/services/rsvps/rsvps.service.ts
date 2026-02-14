import { supabaseClient } from '../supabase/client'
import { throwIfPostgrestError } from '../supabase/errors'
import type { Rsvp } from '../../types/domain'

export async function listRsvpsByPostIds(postIds: string[]): Promise<Rsvp[]> {
  if (postIds.length === 0) return []

  const { data, error } = await supabaseClient.from('rsvps').select('*').in('post_id', postIds)
  throwIfPostgrestError(error)

  return (data ?? []) as Rsvp[]
}

export async function addRsvp(postId: string, userId: string): Promise<void> {
  const { error } = await supabaseClient.from('rsvps').insert({ post_id: postId, user_id: userId })
  throwIfPostgrestError(error)
}

export async function removeRsvp(postId: string, userId: string): Promise<void> {
  const { error } = await supabaseClient
    .from('rsvps')
    .delete()
    .match({ post_id: postId, user_id: userId })
  throwIfPostgrestError(error)
}
