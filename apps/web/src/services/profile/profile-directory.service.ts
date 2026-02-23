import type { PostgrestError } from '@supabase/supabase-js'

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
  user_id: string | null
  author: string | null
  created_at: string
  updated_at: string | null
}

type LegacyActivityUserRecord = {
  user_id: string | null
  author: string | null
  created_at: string
}

type ProfileUpdateRecord = {
  user_id: string
  updated_at: string
}

type LegacyProfileUpdateRecord = {
  user_id: string
  created_at: string
}

type ActivityRecord = {
  userId: string
  activityAt: string
  author: string | null
}

type UserActivitySnapshot = {
  lastActiveAt: string
  latestAuthor: string | null
}

function isNotNull<T>(value: T | null): value is T {
  return value !== null
}

function normalizeNickname(value: string | null | undefined, userId: string): string {
  const trimmed = value?.trim() ?? ''
  if (trimmed.length > 0) return trimmed
  return `User ${userId.slice(0, 8)}`
}

function getTimestamp(value: string): number {
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return -1
  return timestamp
}

function isMissingColumnError(error: PostgrestError | null, columnName: string): boolean {
  if (!error) return false

  const message = String(error.message || '').toLowerCase()
  if (error.code === 'PGRST204' && message.includes(columnName.toLowerCase())) return true
  if (error.code === '42703' && message.includes(columnName.toLowerCase())) return true
  return false
}

function pickActivityAt(record: { created_at: string; updated_at: string | null }): string | null {
  const createdAtMs = getTimestamp(record.created_at)
  const updatedAtMs = getTimestamp(record.updated_at ?? '')

  if (createdAtMs < 0 && updatedAtMs < 0) return null
  if (updatedAtMs >= createdAtMs && updatedAtMs >= 0 && record.updated_at) return record.updated_at
  if (createdAtMs >= 0) return record.created_at
  return record.updated_at
}

function toActivityRecords(records: ActivityUserRecord[]): ActivityRecord[] {
  return records
    .map((record) => {
      const userId = record.user_id?.trim() ?? ''
      if (!userId) return null

      const activityAt = pickActivityAt(record)
      if (!activityAt) return null

      return {
        userId,
        activityAt,
        author: record.author?.trim() ?? null,
      }
    })
    .filter((record): record is ActivityRecord => record !== null)
}

async function listActivityRecordsByTable(table: 'posts' | 'community_posts' | 'comments' | 'community_comments'): Promise<ActivityRecord[]> {
  const withUpdatedAt = await supabaseClient
    .from(table)
    .select('user_id, author, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (!withUpdatedAt.error) {
    return toActivityRecords((withUpdatedAt.data ?? []) as ActivityUserRecord[])
  }

  if (!isMissingColumnError(withUpdatedAt.error, 'updated_at')) {
    throwIfPostgrestError(withUpdatedAt.error)
    return []
  }

  const legacy = await supabaseClient
    .from(table)
    .select('user_id, author, created_at')
    .order('created_at', { ascending: false })

  throwIfPostgrestError(legacy.error)

  const legacyRows = (legacy.data ?? []) as LegacyActivityUserRecord[]
  return toActivityRecords(
    legacyRows.map((row) => ({
      ...row,
      updated_at: null,
    })),
  )
}

async function listProfileUpdateActivityRecords(): Promise<ActivityRecord[]> {
  const withUpdatedAt = await supabaseClient.from('user_profile_details').select('user_id, updated_at')

  if (!withUpdatedAt.error) {
    const rows = (withUpdatedAt.data ?? []) as ProfileUpdateRecord[]
    return rows
      .map((row): ActivityRecord | null => {
        const userId = row.user_id.trim()
        if (!userId) return null
        if (getTimestamp(row.updated_at) < 0) return null

        return {
          userId,
          activityAt: row.updated_at,
          author: null,
        }
      })
      .filter(isNotNull)
  }

  if (!isMissingColumnError(withUpdatedAt.error, 'updated_at')) {
    throwIfPostgrestError(withUpdatedAt.error)
    return []
  }

  const legacy = await supabaseClient.from('user_profile_details').select('user_id, created_at')
  throwIfPostgrestError(legacy.error)

  const rows = (legacy.data ?? []) as LegacyProfileUpdateRecord[]
  return rows
    .map((row): ActivityRecord | null => {
      const userId = row.user_id.trim()
      if (!userId) return null
      if (getTimestamp(row.created_at) < 0) return null

      return {
        userId,
        activityAt: row.created_at,
        author: null,
      }
    })
    .filter(isNotNull)
}

export async function listProfileDirectoryUsers(): Promise<ProfileDirectoryUser[]> {
  const [posts, communityPosts, comments, communityComments, profileUpdates] = await Promise.all([
    listActivityRecordsByTable('posts'),
    listActivityRecordsByTable('community_posts'),
    listActivityRecordsByTable('comments'),
    listActivityRecordsByTable('community_comments'),
    listProfileUpdateActivityRecords(),
  ])

  const recentByUser = new Map<string, UserActivitySnapshot>()
  const allRecords = [...posts, ...communityPosts, ...comments, ...communityComments, ...profileUpdates].sort(
    (a, b) => getTimestamp(b.activityAt) - getTimestamp(a.activityAt),
  )

  for (const record of allRecords) {
    const existing = recentByUser.get(record.userId)

    if (!existing) {
      recentByUser.set(record.userId, {
        lastActiveAt: record.activityAt,
        latestAuthor: record.author,
      })
      continue
    }

    if (!existing.latestAuthor && record.author) {
      recentByUser.set(record.userId, {
        ...existing,
        latestAuthor: record.author,
      })
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
        nickname: normalizeNickname(latest.latestAuthor, userId),
        avatarUrl: avatarByUserId[userId] ?? null,
        lastActiveAt: latest.lastActiveAt,
      }
    })
    .filter((user): user is ProfileDirectoryUser => user !== null)
    .sort((a, b) => getTimestamp(b.lastActiveAt) - getTimestamp(a.lastActiveAt))
}
