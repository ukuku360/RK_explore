
import { supabaseClient as supabase } from '../supabase/client'
import type { CommunityPost } from '../../types/domain'

export async function fetchCommunityPosts(): Promise<CommunityPost[]> {
  const { data, error } = await supabase
    .from('community_posts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function createCommunityPost(
  content: string,
  author: string,
  userId: string,
): Promise<CommunityPost> {
  const { data, error } = await supabase
    .from('community_posts')
    .insert({
      content,
      author,
      user_id: userId,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteCommunityPost(postId: string): Promise<void> {
  const { error } = await supabase.from('community_posts').delete().eq('id', postId)

  if (error) throw error
}
