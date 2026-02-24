import type { AnalyticsEvent } from '../../../types/domain'

export const ADMIN_METRIC_EVENT_NAMES = [
  'feed_view',
  'post_create_start',
  'post_create_success',
  'vote_cast',
  'rsvp_join',
] as const

const CORE_ACTION_EVENTS = new Set(['vote_cast', 'rsvp_join', 'post_create_success'])
const FEED_ACTION_EVENTS = new Set(['vote_cast', 'rsvp_join'])

export type AdminMetricsSnapshot = {
  activationRate: number | null
  postCompletionRate: number | null
  feedActionRate: number | null
  feedViewUsers: number
  coreActionUsers: number
  feedActionUsers: number
  postCreateStartCount: number
  postCreateSuccessCount: number
  eventCountByName: Record<string, number>
}

function safeRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return numerator / denominator
}

function countDistinctUsers(events: AnalyticsEvent[], eventNameSet: Set<string>): number {
  const userIds = new Set<string>()

  for (const event of events) {
    if (!eventNameSet.has(event.event_name)) continue
    if (!event.user_id) continue
    userIds.add(event.user_id)
  }

  return userIds.size
}

function countEventsByName(events: AnalyticsEvent[]): Record<string, number> {
  const counts: Record<string, number> = {}

  for (const event of events) {
    counts[event.event_name] = (counts[event.event_name] ?? 0) + 1
  }

  return counts
}

export function computeAdminMetrics(events: AnalyticsEvent[]): AdminMetricsSnapshot {
  const eventCountByName = countEventsByName(events)
  const feedViewUsers = countDistinctUsers(events, new Set(['feed_view']))
  const coreActionUsers = countDistinctUsers(events, CORE_ACTION_EVENTS)
  const feedActionUsers = countDistinctUsers(events, FEED_ACTION_EVENTS)
  const postCreateStartCount = eventCountByName.post_create_start ?? 0
  const postCreateSuccessCount = eventCountByName.post_create_success ?? 0

  return {
    activationRate: safeRate(coreActionUsers, feedViewUsers),
    postCompletionRate: safeRate(postCreateSuccessCount, postCreateStartCount),
    feedActionRate: safeRate(feedActionUsers, feedViewUsers),
    feedViewUsers,
    coreActionUsers,
    feedActionUsers,
    postCreateStartCount,
    postCreateSuccessCount,
    eventCountByName,
  }
}

export function formatPercent(value: number | null): string {
  if (value === null) return '-'
  return `${(value * 100).toFixed(1)}%`
}
