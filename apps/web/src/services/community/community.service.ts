
import { supabaseClient as supabase } from '../supabase/client'
import type { CommunityPost, CommunityComment } from '../../types/domain'

export async function fetchCommunityPosts(currentUserId?: string): Promise<CommunityPost[]> {
  const { data: posts, error } = await supabase
    .from('community_posts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  if (!posts) return []

  // Fetch counts for likes and comments
  const postIds = posts.map(p => p.id)
  
  const { data: likesData } = await supabase
    .from('community_likes')
    .select('post_id')
    .in('post_id', postIds)
  
  const { data: commentsData } = await supabase
    .from('community_comments')
    .select('post_id')
    .in('post_id', postIds)

  // Count likes and comments per post
  const likesCounts = new Map<string, number>()
  likesData?.forEach(like => {
    likesCounts.set(like.post_id, (likesCounts.get(like.post_id) ?? 0) + 1)
  })

  const commentsCounts = new Map<string, number>()
  commentsData?.forEach(comment => {
    commentsCounts.set(comment.post_id, (commentsCounts.get(comment.post_id) ?? 0) + 1)
  })

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
    likes_count: likesCounts.get(post.id) ?? 0,
    comments_count: commentsCounts.get(post.id) ?? 0,
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
