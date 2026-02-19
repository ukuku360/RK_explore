import { listUserProfileAvatars } from './profile-details.service'
import { supabaseClient } from '../supabase/client'
import { throwIfPostgrestError } from '../supabase/errors'

export type ProfileDirectoryUser = {
  userId: string
  nickname: string
  avatarUrl: string | null
  lastActiveAt: string
}

type ActivityUserRecord = {
  user_id: string
  author: string
  created_at: string
}

function normalizeNickname(value: string | null | undefined, userId: string): string {
  const trimmed = value?.trim() ?? ''
  if (trimmed.length > 0) return trimmed
  return `User ${userId.slice(0, 8)}`
}

export async function listProfileDirectoryUsers(limit = 200): Promise<ProfileDirectoryUser[]> {
  const [postsResult, communityPostsResult] = await Promise.all([
    supabaseClient
      .from('posts')
      .select('user_id, author, created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabaseClient
      .from('community_posts')
      .select('user_id, author, created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  throwIfPostgrestError(postsResult.error)
  throwIfPostgrestError(communityPostsResult.error)

  const recentByUser = new Map<string, ActivityUserRecord>()
  const allRecords = [
    ...((postsResult.data ?? []) as ActivityUserRecord[]),
    ...((communityPostsResult.data ?? []) as ActivityUserRecord[]),
  ]

  for (const record of allRecords) {
    const existing = recentByUser.get(record.user_id)
    if (!existing) {
      recentByUser.set(record.user_id, record)
      continue
    }

    const existingTime = new Date(existing.created_at).getTime()
    const candidateTime = new Date(record.created_at).getTime()

    if (Number.isNaN(existingTime) || candidateTime > existingTime) {
      recentByUser.set(record.user_id, record)
    }
  }

  const userIds = Array.from(recentByUser.keys())
  const avatarByUserId = await listUserProfileAvatars(userIds)

  return userIds
    .map((userId) => {
      const latest = recentByUser.get(userId)
      if (!latest) return null

      return {
        userId,
        nickname: normalizeNickname(latest.author, userId),
        avatarUrl: avatarByUserId[userId] ?? null,
        lastActiveAt: latest.created_at,
      }
    })
    .filter((user): user is ProfileDirectoryUser => user !== null)
    .sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime())
}
