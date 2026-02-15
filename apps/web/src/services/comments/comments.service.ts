import { supabaseClient } from '../supabase/client'
import { throwIfPostgrestError } from '../supabase/errors'
import type { Comment } from '../../types/domain'

type CreateCommentInput = {
  post_id: string
  parent_comment_id?: string | null
  user_id: string
  author: string
  text: string
}

export async function listCommentsByPostIds(postIds: string[]): Promise<Comment[]> {
  if (postIds.length === 0) return []

  const { data, error } = await supabaseClient
    .from('comments')
    .select('*')
    .in('post_id', postIds)
    .order('created_at', { ascending: true })
  throwIfPostgrestError(error)

  return (data ?? []) as Comment[]
}

export async function createComment(input: CreateCommentInput): Promise<void> {
  const { error } = await supabaseClient.from('comments').insert(input)
  throwIfPostgrestError(error)
}
