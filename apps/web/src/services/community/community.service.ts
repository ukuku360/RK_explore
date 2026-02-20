import { supabaseClient as supabase } from '../supabase/client'
import { throwIfPostgrestError } from '../supabase/errors'
import type { CommunityPost, CommunityComment, CommunityPostCategory } from '../../types/domain'

export async function fetchCommunityPosts(currentUserId?: string): Promise<CommunityPost[]> {
  const { data: posts, error } = await supabase
    .from('community_posts')
    .select('*')
    .order('created_at', { ascending: false })

  throwIfPostgrestError(error)

  if (!posts || posts.length === 0) {
    return []
  }

  const postIds = posts.map((post) => post.id)
  const userLikesPromise = currentUserId
    ? supabase.from('community_likes').select('post_id').eq('user_id', currentUserId)
    : Promise.resolve({ data: [] as Array<{ post_id: string }>, error: null })

  const [likesResult, commentsResult, userLikesResult] = await Promise.all([
    supabase.from('community_likes').select('post_id').in('post_id', postIds),
    supabase.from('community_comments').select('post_id').in('post_id', postIds),
    userLikesPromise,
  ])

  throwIfPostgrestError(likesResult.error)
  throwIfPostgrestError(commentsResult.error)
  throwIfPostgrestError(userLikesResult.error)

  const likesData = likesResult.data ?? []
  const commentsData = commentsResult.data ?? []
  const userLikes = userLikesResult.data ?? []

  const likesCounts = new Map<string, number>()
  likesData.forEach((like) => {
    likesCounts.set(like.post_id, (likesCounts.get(like.post_id) ?? 0) + 1)
  })

  const commentsCounts = new Map<string, number>()
  commentsData.forEach((comment) => {
    commentsCounts.set(comment.post_id, (commentsCounts.get(comment.post_id) ?? 0) + 1)
  })

  const likedPostIds = new Set<string>()
  userLikes.forEach((like) => likedPostIds.add(like.post_id))

  return posts.map((post: CommunityPost) => ({
    ...post,
    likes_count: likesCounts.get(post.id) ?? 0,
    comments_count: commentsCounts.get(post.id) ?? 0,
    has_liked: likedPostIds.has(post.id),
  }))
}

export async function createCommunityPost(
  content: string,
  author: string,
  userId: string,
  category: CommunityPostCategory = 'general',
): Promise<CommunityPost> {
  const { data, error } = await supabase
    .from('community_posts')
    .insert({
      content,
      author,
      user_id: userId,
      category,
    })
    .select()
    .single()

  throwIfPostgrestError(error)

  if (!data) {
    throw new Error('Failed to create community post: no data returned from server')
  }

  return {
    ...data,
    likes_count: 0,
    comments_count: 0,
    has_liked: false,
  }
}

export async function updateCommunityPost(
  postId: string,
  content: string,
  category?: CommunityPostCategory,
): Promise<CommunityPost> {
  const updates: Record<string, string> = { content }
  if (category) {
    updates.category = category
  }

  const { data, error } = await supabase
    .from('community_posts')
    .update(updates)
    .eq('id', postId)
    .select()
    .single()

  throwIfPostgrestError(error)

  if (!data) {
    throw new Error('Failed to update community post: no data returned from server')
  }

  return data
}

export async function deleteCommunityPost(postId: string): Promise<void> {
  const { error } = await supabase.from('community_posts').delete().eq('id', postId)
  throwIfPostgrestError(error)
}

export async function toggleLike(postId: string, userId: string): Promise<void> {
  const { data: existingLike, error: likeCheckError } = await supabase
    .from('community_likes')
    .select('post_id')
    .match({ post_id: postId, user_id: userId })
    .maybeSingle()
  throwIfPostgrestError(likeCheckError)

  if (existingLike) {
    const { error } = await supabase
      .from('community_likes')
      .delete()
      .match({ post_id: postId, user_id: userId })
    throwIfPostgrestError(error)
  } else {
    const { error } = await supabase
      .from('community_likes')
      .insert({ post_id: postId, user_id: userId })
    throwIfPostgrestError(error)
  }
}

export async function fetchComments(postId: string): Promise<CommunityComment[]> {
  const { data, error } = await supabase
    .from('community_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  throwIfPostgrestError(error)
  return data ?? []
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

  throwIfPostgrestError(error)
  return data
}

export async function updateComment(commentId: string, content: string): Promise<CommunityComment> {
  const { data, error } = await supabase
    .from('community_comments')
    .update({ content })
    .eq('id', commentId)
    .select()
    .single()

  throwIfPostgrestError(error)

  if (!data) {
    throw new Error('Failed to update comment: no data returned from server')
  }

  return data
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('community_comments').delete().eq('id', commentId)
  throwIfPostgrestError(error)
}
