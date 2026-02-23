import { listCommentsByPostIds } from '../comments/comments.service'
import { listRsvpsByPostIds } from '../rsvps/rsvps.service'
import { supabaseClient } from '../supabase/client'
import { throwIfPostgrestError } from '../supabase/errors'
import { listVotesByPostIds } from '../votes/votes.service'
import type {
  Category,
  CreatePostInput,
  Post,
  PostRecord,
  UpdatePostModerationInput,
} from '../../types/domain'

export type UpdatePostInput = {
  location: string
  category: Category
  proposed_date: string | null
  capacity: number
  meetup_place: string | null
  meeting_time: string | null
  estimated_cost: number | null
  prep_notes: string | null
  rsvp_deadline: string | null
}

function groupByPostId<T extends { post_id: string }>(items: T[]): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((accumulator, item) => {
    const key = item.post_id
    const existing = accumulator[key] ?? []
    existing.push(item)
    accumulator[key] = existing
    return accumulator
  }, {})
}

export async function listPosts(limit = 50): Promise<PostRecord[]> {
  const { data, error } = await supabaseClient
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  throwIfPostgrestError(error)
  return (data ?? []) as PostRecord[]
}

export async function listPostsWithRelations(limit = 50): Promise<Post[]> {
  const posts = await listPosts(limit)
  if (posts.length === 0) return []

  const postIds = posts.map((post) => post.id)

  // Independent table queries are intentionally parallelized to avoid request waterfalls.
  const [votes, rsvps, comments] = await Promise.all([
    listVotesByPostIds(postIds),
    listRsvpsByPostIds(postIds),
    listCommentsByPostIds(postIds),
  ])

  const votesByPostId = groupByPostId(votes)
  const rsvpsByPostId = groupByPostId(rsvps)
  const commentsByPostId = groupByPostId(comments)

  return posts.map((post) => ({
    ...post,
    votes: votesByPostId[post.id] ?? [],
    rsvps: rsvpsByPostId[post.id] ?? [],
    comments: commentsByPostId[post.id] ?? [],
  }))
}

export async function createPost(input: CreatePostInput): Promise<void> {
  const payload = {
    ...input,
    status: input.status ?? 'proposed',
  }

  const { error } = await supabaseClient.from('posts').insert(payload)
  throwIfPostgrestError(error)
}

export async function confirmPost(postId: string): Promise<void> {
  const { error } = await supabaseClient.from('posts').update({ status: 'confirmed' }).eq('id', postId)
  throwIfPostgrestError(error)
}

export async function deletePost(postId: string): Promise<void> {
  const { error } = await supabaseClient.from('posts').delete().eq('id', postId)
  throwIfPostgrestError(error)
}

export async function updatePost(postId: string, userId: string, input: UpdatePostInput): Promise<void> {
  const { data, error } = await supabaseClient
    .from('posts')
    .update(input)
    .eq('id', postId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()
  throwIfPostgrestError(error)
  if (!data) {
    throw new Error('Unable to update post. The post was not found or you do not have permission.')
  }
}

export async function updatePostModeration(postId: string, input: UpdatePostModerationInput): Promise<void> {
  const { error } = await supabaseClient.from('posts').update(input).eq('id', postId)
  throwIfPostgrestError(error)
}
