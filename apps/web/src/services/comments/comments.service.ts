import type { PostgrestError } from '@supabase/supabase-js'

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

function isMissingColumnError(error: PostgrestError | null, columnName: string): boolean {
  if (!error) return false

  const message = String(error.message || '')
  if (error.code === 'PGRST204' && message.includes(`'${columnName}' column`)) return true
  if (error.code === '42703' && message.toLowerCase().includes(columnName.toLowerCase())) return true

  return false
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
  if (!error) return

  if (input.parent_comment_id && isMissingColumnError(error, 'parent_comment_id')) {
    const fallbackInput = {
      post_id: input.post_id,
      user_id: input.user_id,
      author: input.author,
      text: input.text,
    }

    const { error: fallbackError } = await supabaseClient.from('comments').insert(fallbackInput)
    throwIfPostgrestError(fallbackError)
    return
  }

  throwIfPostgrestError(error)
}
