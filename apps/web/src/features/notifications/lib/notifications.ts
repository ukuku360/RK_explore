import type { Post, Report } from '../../../types/domain'

export const NOTIFICATION_RETENTION_DAYS = 14

export type NotificationType = 'comment' | 'mention' | 'report_result' | 'meetup_update'

export type NotificationItem = {
  id: string
  type: NotificationType
  title: string
  message: string
  createdAt: string
  targetPath: string
}

function hasMention(text: string, nickname: string): boolean {
  const normalizedNickname = nickname.trim().toLowerCase()
  if (!normalizedNickname) return false
  return text.toLowerCase().includes(`@${normalizedNickname}`)
}

function isWithinRetention(dateIso: string, nowMs: number, retentionDays: number): boolean {
  const createdAtMs = new Date(dateIso).getTime()
  if (Number.isNaN(createdAtMs)) return false

  const retentionMs = retentionDays * 24 * 60 * 60 * 1000
  return nowMs - createdAtMs <= retentionMs
}

export function buildNotifications(input: {
  posts: Post[]
  reports: Report[]
  userId: string
  nickname: string
  retentionDays?: number
  nowMs?: number
}): NotificationItem[] {
  const nowMs = input.nowMs ?? Date.now()
  const retentionDays = input.retentionDays ?? NOTIFICATION_RETENTION_DAYS
  const notifications: NotificationItem[] = []

  for (const post of input.posts) {
    for (const comment of post.comments) {
      if (!isWithinRetention(comment.created_at, nowMs, retentionDays)) continue

      if (post.user_id === input.userId && comment.user_id !== input.userId) {
        notifications.push({
          id: `comment:${comment.id}`,
          type: 'comment',
          title: 'New comment on your post',
          message: `${comment.author} commented on ${post.location}.`,
          createdAt: comment.created_at,
          targetPath: `/?post=${post.id}`,
        })
      }

      if (comment.user_id !== input.userId && hasMention(comment.text, input.nickname)) {
        notifications.push({
          id: `mention:${comment.id}`,
          type: 'mention',
          title: 'You were mentioned',
          message: `${comment.author} mentioned you in a comment.`,
          createdAt: comment.created_at,
          targetPath: `/?post=${post.id}`,
        })
      }
    }

    const hasJoined = post.rsvps.some((rsvp) => rsvp.user_id === input.userId)
    if (hasJoined && post.status === 'confirmed' && isWithinRetention(post.created_at, nowMs, retentionDays)) {
      notifications.push({
        id: `meetup:${post.id}:confirmed`,
        type: 'meetup_update',
        title: 'Meetup status updated',
        message: `${post.location} is now confirmed.`,
        createdAt: post.created_at,
        targetPath: `/?post=${post.id}`,
      })
    }
  }

  for (const report of input.reports) {
    const eventDate = report.reviewed_at ?? report.created_at
    if (!isWithinRetention(eventDate, nowMs, retentionDays)) continue
    if (report.status === 'open') continue

    notifications.push({
      id: `report:${report.id}:${report.status}`,
      type: 'report_result',
      title: 'Report status updated',
      message: report.status === 'actioned' ? 'Your report was actioned by a moderator.' : 'Your report was dismissed.',
      createdAt: eventDate,
      targetPath: report.target_type === 'community' ? '/community' : '/',
    })
  }

  return notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}
