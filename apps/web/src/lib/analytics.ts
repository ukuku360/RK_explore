import { logger } from './logger'
import { createAnalyticsEvent } from '../services/analytics/analytics.service'
import type { AnalyticsProperties, AnalyticsRole } from '../types/domain'

type AnalyticsValue = string | number | boolean | null | undefined

export type AnalyticsPayload = Record<string, AnalyticsValue>

const RESERVED_KEYS = new Set(['user_id', 'role', 'post_id', 'surface'])

function normalizeRole(value: AnalyticsValue): AnalyticsRole | null {
  if (value === 'admin' || value === 'member') return value
  return null
}

function normalizeNonEmptyString(value: AnalyticsValue): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function toAnalyticsProperties(payload: AnalyticsPayload): AnalyticsProperties {
  const properties: AnalyticsProperties = {}

  for (const [key, value] of Object.entries(payload)) {
    if (RESERVED_KEYS.has(key)) continue
    if (typeof value === 'undefined') continue
    properties[key] = value
  }

  return properties
}

export function trackEvent(eventName: string, payload: AnalyticsPayload = {}): void {
  if (import.meta.env.DEV) {
    console.info('[analytics]', eventName, payload)
  }

  const userId = normalizeNonEmptyString(payload.user_id)
  const role = normalizeRole(payload.role)
  const surface = normalizeNonEmptyString(payload.surface)

  if (!userId || !role || !surface) {
    if (import.meta.env.DEV) {
      logger.warn('[analytics] skipped event without required context', eventName, payload)
    }
    return
  }

  const postId = normalizeNonEmptyString(payload.post_id)
  const properties = toAnalyticsProperties(payload)

  void createAnalyticsEvent({
    event_name: eventName,
    user_id: userId,
    role,
    post_id: postId,
    surface,
    properties,
  }).catch((error) => {
    logger.warn('[analytics] failed to persist event', eventName, error)
  })
}
