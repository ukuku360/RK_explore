import { supabaseClient as supabase } from '../supabase/client'
import { throwIfPostgrestError } from '../supabase/errors'
import type { CommunityPost, CommunityComment } from '../../types/domain'

const LOCAL_COMMUNITY_POSTS_KEY = 'rk.community.localPosts'

type LocalCommunityPost = Pick<CommunityPost, 'id' | 'user_id' | 'author' | 'content' | 'created_at'>

function readLocalCommunityPosts(): LocalCommunityPost[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(LOCAL_COMMUNITY_POSTS_KEY)
    if (!raw) return []

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter((item): item is LocalCommunityPost => {
      return Boolean(
        item &&
          typeof item === 'object' &&
          typeof item.id === 'string' &&
          typeof item.user_id === 'string' &&
          typeof item.author === 'string' &&
          typeof item.content === 'string' &&
          typeof item.created_at === 'string',
      )
    })
  } catch {
    return []
  }
}

function writeLocalCommunityPosts(posts: LocalCommunityPost[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LOCAL_COMMUNITY_POSTS_KEY, JSON.stringify(posts))
}

function saveLocalCommunityPost(post: LocalCommunityPost): void {
  const current = readLocalCommunityPosts().filter((entry) => entry.id !== post.id)
  writeLocalCommunityPosts([post, ...current])
}

function reconcileLocalCommunityPosts(serverPostIds: Set<string>): void {
  const current = readLocalCommunityPosts()
  if (current.length === 0) return

  const filtered = current.filter((post) => !serverPostIds.has(post.id))
  if (filtered.length === current.length) return
  writeLocalCommunityPosts(filtered)
}

export async function fetchCommunityPosts(currentUserId?: string): Promise<CommunityPost[]> {
  const { data: posts, error } = await supabase
    .from('community_posts')
    .select('*')
    .order('created_at', { ascending: false })

  throwIfPostgrestError(error)
  const localPosts = readLocalCommunityPosts()

  if (!posts || posts.length === 0) {
    return localPosts.map((post) => ({
      ...post,
      likes_count: 0,
      comments_count: 0,
      has_liked: false,
    }))
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

  const mappedServerPosts = posts.map((post: CommunityPost) => ({
    ...post,
    likes_count: likesCounts.get(post.id) ?? 0,
    comments_count: commentsCounts.get(post.id) ?? 0,
    has_liked: likedPostIds.has(post.id),
  }))

  const serverPostIds = new Set(mappedServerPosts.map((post) => post.id))
  reconcileLocalCommunityPosts(serverPostIds)
  const missingLocalPosts = localPosts.filter((post) => !serverPostIds.has(post.id))

  if (missingLocalPosts.length === 0) return mappedServerPosts

  const mappedLocalPosts: CommunityPost[] = missingLocalPosts.map((post) => ({
    ...post,
    likes_count: 0,
    comments_count: 0,
    has_liked: false,
  }))

  return [...mappedLocalPosts, ...mappedServerPosts].sort((a, b) =>
    a.created_at > b.created_at ? -1 : a.created_at < b.created_at ? 1 : 0,
  )
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

  throwIfPostgrestError(error)

  if (error) throw error

  saveLocalCommunityPost({
    id: data.id,
    user_id: data.user_id,
    author: data.author,
    content: data.content,
    created_at: data.created_at,
  })
  
  // Return with initial counts
  return {
    ...data,
    likes_count: 0,
    comments_count: 0,
    has_liked: false,
  }
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

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('community_comments').delete().eq('id', commentId)
  throwIfPostgrestError(error)
}
