import { describe, expect, it } from 'vitest'

import { getRsvpSnapshot, getRsvpSummary, isRsvpClosed } from '../rsvp'
import type { Post } from '../../../../types/domain'

function createPost(overrides?: Partial<Post>): Post {
  return {
    id: 'post-1',
    location: 'Bondi',
    author: 'Tenant',
    user_id: 'owner-1',
    proposed_date: '2026-03-10',
    category: 'Travel',
    status: 'proposed',
    capacity: 2,
    meetup_place: null,
    meeting_time: null,
    estimated_cost: null,
    prep_notes: null,
    rsvp_deadline: null,
    is_hidden: false,
    hidden_reason: null,
    hidden_by: null,
    hidden_at: null,
    created_at: '2026-02-14T10:00:00.000Z',
    votes: [],
    comments: [],
    rsvps: [],
    ...overrides,
  }
}

describe('rsvp helpers', () => {
  it('calculates waitlist position based on created_at ordering', () => {
    const post = createPost({
      rsvps: [
        { id: 'r1', post_id: 'post-1', user_id: 'u1', created_at: '2026-02-14T10:00:00.000Z' },
        { id: 'r2', post_id: 'post-1', user_id: 'u2', created_at: '2026-02-14T10:01:00.000Z' },
        { id: 'r3', post_id: 'post-1', user_id: 'u3', created_at: '2026-02-14T10:02:00.000Z' },
      ],
    })

    const summary = getRsvpSummary(post, 'u3')
    expect(summary.goingCount).toBe(2)
    expect(summary.waitlistCount).toBe(1)
    expect(summary.isWaitlisted).toBe(true)
    expect(summary.waitlistPosition).toBe(1)
  })

  it('returns ordered unique going and waitlist user ids', () => {
    const post = createPost({
      rsvps: [
        { id: 'r2', post_id: 'post-1', user_id: 'u2', created_at: '2026-02-14T10:01:00.000Z' },
        { id: 'r1', post_id: 'post-1', user_id: 'u1', created_at: '2026-02-14T10:00:00.000Z' },
        { id: 'r3', post_id: 'post-1', user_id: 'u2', created_at: '2026-02-14T10:02:00.000Z' },
        { id: 'r4', post_id: 'post-1', user_id: 'u3', created_at: '2026-02-14T10:03:00.000Z' },
      ],
    })

    const snapshot = getRsvpSnapshot(post, 'u3')
    expect(snapshot.goingUserIds).toEqual(['u1', 'u2'])
    expect(snapshot.waitlistUserIds).toEqual(['u3'])
  })

  it('detects closed deadlines', () => {
    const closed = createPost({ rsvp_deadline: '2020-01-01T00:00:00.000Z' })
    const open = createPost({ rsvp_deadline: '2099-01-01T00:00:00.000Z' })

    expect(isRsvpClosed(closed)).toBe(true)
    expect(isRsvpClosed(open)).toBe(false)
  })
})
