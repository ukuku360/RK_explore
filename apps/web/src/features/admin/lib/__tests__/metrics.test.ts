import { describe, expect, it } from 'vitest'

import { computeAdminMetrics, formatPercent } from '../metrics'
import type { AnalyticsEvent } from '../../../../types/domain'

function createEvent(overrides: Partial<AnalyticsEvent>): AnalyticsEvent {
  return {
    id: 'event-1',
    event_name: 'feed_view',
    user_id: 'user-1',
    role: 'member',
    post_id: null,
    surface: 'feed',
    properties: {},
    created_at: '2026-02-24T00:00:00.000Z',
    ...overrides,
  }
}

describe('admin analytics metrics', () => {
  it('computes activation and feed action rates from unique users', () => {
    const events = [
      createEvent({ id: 'e1', event_name: 'feed_view', user_id: 'u1' }),
      createEvent({ id: 'e2', event_name: 'feed_view', user_id: 'u2' }),
      createEvent({ id: 'e3', event_name: 'vote_cast', user_id: 'u1' }),
      createEvent({ id: 'e4', event_name: 'rsvp_join', user_id: 'u2' }),
      createEvent({ id: 'e5', event_name: 'post_create_success', user_id: 'u1' }),
    ]

    const metrics = computeAdminMetrics(events)

    expect(metrics.feedViewUsers).toBe(2)
    expect(metrics.coreActionUsers).toBe(2)
    expect(metrics.feedActionUsers).toBe(2)
    expect(metrics.activationRate).toBe(1)
    expect(metrics.feedActionRate).toBe(1)
  })

  it('computes post completion from start and success counts', () => {
    const events = [
      createEvent({ id: 'e1', event_name: 'post_create_start' }),
      createEvent({ id: 'e2', event_name: 'post_create_start', user_id: 'u2' }),
      createEvent({ id: 'e3', event_name: 'post_create_success' }),
    ]

    const metrics = computeAdminMetrics(events)

    expect(metrics.postCreateStartCount).toBe(2)
    expect(metrics.postCreateSuccessCount).toBe(1)
    expect(metrics.postCompletionRate).toBe(0.5)
  })

  it('returns null rates when denominator is zero', () => {
    const metrics = computeAdminMetrics([])

    expect(metrics.activationRate).toBeNull()
    expect(metrics.feedActionRate).toBeNull()
    expect(metrics.postCompletionRate).toBeNull()
    expect(formatPercent(metrics.activationRate)).toBe('-')
  })
})
