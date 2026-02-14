import { supabaseClient } from '../supabase/client'
import { throwIfPostgrestError } from '../supabase/errors'
import type { Vote } from '../../types/domain'

export async function listVotesByPostIds(postIds: string[]): Promise<Vote[]> {
  if (postIds.length === 0) return []

  const { data, error } = await supabaseClient.from('votes').select('*').in('post_id', postIds)
  throwIfPostgrestError(error)

  return (data ?? []) as Vote[]
}

export async function addVote(postId: string, userId: string): Promise<void> {
  const { error } = await supabaseClient.from('votes').insert({ post_id: postId, user_id: userId })
  throwIfPostgrestError(error)
}

export async function removeVote(postId: string, userId: string): Promise<void> {
  const { error } = await supabaseClient
    .from('votes')
    .delete()
    .match({ post_id: postId, user_id: userId })
  throwIfPostgrestError(error)
}
