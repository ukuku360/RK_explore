import type { Post } from '../../../types/domain'

export type RsvpSummary = {
  capacity: number
  goingCount: number
  waitlistCount: number
  isFull: boolean
  isGoing: boolean
  isWaitlisted: boolean
  hasRsvpd: boolean
  waitlistPosition: number
}

export type RsvpSnapshot = {
  summary: RsvpSummary
  goingUserIds: string[]
  waitlistUserIds: string[]
}

export function isRsvpClosed(post: Post): boolean {
  if (!post.rsvp_deadline) return false
  return new Date(post.rsvp_deadline).getTime() < Date.now()
}

export function getRsvpSnapshot(post: Post, viewerUserId: string): RsvpSnapshot {
  const sortedEntries = [...post.rsvps].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
  const uniqueEntries = []
  const seenUserIds = new Set<string>()

  for (const entry of sortedEntries) {
    if (!entry?.user_id) continue
    if (seenUserIds.has(entry.user_id)) continue
    seenUserIds.add(entry.user_id)
    uniqueEntries.push(entry)
  }

  const goingEntries = uniqueEntries.slice(0, post.capacity)
  const waitlistEntries = uniqueEntries.slice(post.capacity)
  const goingIds = goingEntries.map((entry) => entry.user_id)
  const waitlistIds = waitlistEntries.map((entry) => entry.user_id)

  const isGoing = goingIds.includes(viewerUserId)
  const isWaitlisted = waitlistIds.includes(viewerUserId)

  return {
    summary: {
      capacity: post.capacity,
      goingCount: goingIds.length,
      waitlistCount: waitlistIds.length,
      isFull: goingIds.length >= post.capacity,
      isGoing,
      isWaitlisted,
      hasRsvpd: isGoing || isWaitlisted,
      waitlistPosition: isWaitlisted ? waitlistIds.indexOf(viewerUserId) + 1 : 0,
    },
    goingUserIds: goingIds,
    waitlistUserIds: waitlistIds,
  }
}

export function getRsvpSummary(post: Post, viewerUserId: string): RsvpSummary {
  return getRsvpSnapshot(post, viewerUserId).summary
}
