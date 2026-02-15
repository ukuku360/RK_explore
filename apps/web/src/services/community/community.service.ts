
import { supabaseClient as supabase } from '../supabase/client'
import type { CommunityPost, CommunityComment } from '../../types/domain'

export async function fetchCommunityPosts(currentUserId?: string): Promise<CommunityPost[]> {
  const { data: posts, error } = await supabase
    .from('community_posts')
    .select(`
      *,
      likes:community_likes(count),
      comments:community_comments(count)
    `)
    .order('created_at', { ascending: false })

  if (error) throw error

  // If user is logged in, fetch their likes to determine has_liked
  let likedPostIds = new Set<string>()
  if (currentUserId) {
    const { data: userLikes } = await supabase
      .from('community_likes')
      .select('post_id')
      .eq('user_id', currentUserId)
    
    if (userLikes) {
      userLikes.forEach(like => likedPostIds.add(like.post_id))
    }
  }

  return posts.map((post: any) => ({
    ...post,
    likes_count: post.likes?.[0]?.count ?? 0,
    comments_count: post.comments?.[0]?.count ?? 0,
    has_liked: likedPostIds.has(post.id)
  }))
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
  
  // Return with initial counts
  return {
    ...data,
    likes_count: 0,
    comments_count: 0,
    has_liked: false
  }
}

export async function deleteCommunityPost(postId: string): Promise<void> {
  const { error } = await supabase.from('community_posts').delete().eq('id', postId)

  if (error) throw error
}

// --- Likes ---

export async function toggleLike(postId: string, userId: string): Promise<void> {
  // Check if like exists
  const { data: existingLike } = await supabase
    .from('community_likes')
    .select('post_id')
    .match({ post_id: postId, user_id: userId })
    .single()

  if (existingLike) {
    // Unlike
    await supabase
      .from('community_likes')
      .delete()
      .match({ post_id: postId, user_id: userId })
  } else {
    // Like
    await supabase
      .from('community_likes')
      .insert({ post_id: postId, user_id: userId })
  }
}

// --- Comments ---

export async function fetchComments(postId: string): Promise<CommunityComment[]> {
  const { data, error } = await supabase
    .from('community_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

export async function createComment(
  postId: string,
  content: string,
  author: string,
  userId: string,
): Promise<CommunityComment> {
  const { data, error } = await supabase
    .from('community_comments')
    .insert({
      post_id: postId,
      content,
      author,
      user_id: userId,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('community_comments').delete().eq('id', commentId)
  if (error) throw error
}
