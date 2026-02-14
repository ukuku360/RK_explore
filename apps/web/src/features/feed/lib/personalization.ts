import type { Post } from '../../../types/domain'

const CLOSING_SOON_MS = 24 * 60 * 60 * 1000
const NEW_POST_WINDOW_MS = 72 * 60 * 60 * 1000

export type FeedTab = 'recommended' | 'my_activity' | 'all'

export type RecommendationMeta = {
  score: number
  reason: string
}

function getCreatedAtMs(post: Post): number {
  return new Date(post.created_at).getTime()
}

function getDeadlineMs(post: Post): number | null {
  if (!post.rsvp_deadline) return null
  const deadlineMs = new Date(post.rsvp_deadline).getTime()
  return Number.isFinite(deadlineMs) ? deadlineMs : null
}

function isClosingSoon(post: Post, nowMs = Date.now()): boolean {
  const deadlineMs = getDeadlineMs(post)
  if (deadlineMs === null) return false

  const diffMs = deadlineMs - nowMs
  return diffMs > 0 && diffMs <= CLOSING_SOON_MS
}

function isNewPost(post: Post, nowMs = Date.now()): boolean {
  const createdMs = getCreatedAtMs(post)
  if (!Number.isFinite(createdMs)) return false
  return nowMs - createdMs <= NEW_POST_WINDOW_MS
}

export function hasPersonalizationData(posts: Post[], userId: string): boolean {
  return posts.some((post) =>
    post.votes.some((vote) => vote.user_id === userId) || post.rsvps.some((rsvp) => rsvp.user_id === userId),
  )
}

export function getMyActivityPosts(posts: Post[], userId: string): Post[] {
  return posts.filter(
    (post) =>
      post.user_id === userId ||
      post.votes.some((vote) => vote.user_id === userId) ||
      post.rsvps.some((rsvp) => rsvp.user_id === userId),
  )
}

function getRecommendationMeta(
  post: Post,
  userId: string,
  hasUserSignals: boolean,
  nowMs = Date.now(),
): RecommendationMeta {
  const hasVoted = post.votes.some((vote) => vote.user_id === userId)
  const hasRsvpd = post.rsvps.some((rsvp) => rsvp.user_id === userId)
  const closingSoon = isClosingSoon(post, nowMs)
  const fresh = isNewPost(post, nowMs)

  let score = Math.min(post.votes.length, 15) * 2
  let reason = 'Popular in community'

  if (hasUserSignals) {
    if (hasRsvpd) {
      score += 60
      reason = 'Because you already RSVPed'
    } else if (hasVoted) {
      score += 45
      reason = 'Because you voted on this post'
    } else if (closingSoon) {
      score += 25
      reason = 'Because RSVP closes within 24h'
    } else if (fresh) {
      score += 16
      reason = 'Because this is newly posted'
    }
  } else if (fresh) {
    score += 32
    reason = 'Because this is newly posted'
  } else if (closingSoon) {
    score += 20
    reason = 'Because RSVP closes soon'
  }

  return { score, reason }
}

export function rankRecommendedPosts(posts: Post[], userId: string, hasUserSignals: boolean, nowMs = Date.now()): {
  rankedPosts: Post[]
  metaByPostId: Record<string, RecommendationMeta>
} {
  const metaByPostId: Record<string, RecommendationMeta> = {}
  const scoredPosts = posts.map((post) => {
    const meta = getRecommendationMeta(post, userId, hasUserSignals, nowMs)
    metaByPostId[post.id] = meta

    return {
      post,
      score: meta.score,
      createdAtMs: getCreatedAtMs(post),
    }
  })

  scoredPosts.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.createdAtMs - a.createdAtMs
  })

  return {
    rankedPosts: scoredPosts.map((entry) => entry.post),
    metaByPostId,
  }
}
