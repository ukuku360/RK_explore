import { describe, expect, it } from 'vitest'

import { buildNotifications } from '../notifications'
import type { Post, Report } from '../../../../types/domain'

function createPost(overrides?: Partial<Post>): Post {
  return {
    id: 'post-1',
    location: 'Bondi',
    author: 'Host',
    user_id: 'owner-1',
    proposed_date: null,
    category: 'Travel',
    status: 'proposed',
    capacity: 4,
    meetup_place: null,
    meeting_time: null,
    estimated_cost: null,
    prep_notes: null,
    rsvp_deadline: null,
    is_hidden: false,
    hidden_reason: null,
    hidden_by: null,
    hidden_at: null,
    image_url: null,
    created_at: '2026-02-10T10:00:00.000Z',
    votes: [],
    comments: [],
    rsvps: [],
    ...overrides,
  }
}

function createReport(overrides?: Partial<Report>): Report {
  return {
    id: 'report-1',
    target_type: 'feed',
    post_id: 'post-1',
    community_post_id: null,
    reporter_user_id: 'user-1',
    reporter_email: 'user@example.com',
    reporter_nickname: 'alex',
    reason: 'spam',
    status: 'actioned',
    created_at: '2026-02-11T10:00:00.000Z',
    reviewed_by: 'admin-1',
    reviewed_at: '2026-02-12T10:00:00.000Z',
    ...overrides,
  }
}

describe('buildNotifications', () => {
  it('builds comment and mention notifications', () => {
    const posts = [
      createPost({
        user_id: 'user-1',
        comments: [
          {
            id: 'comment-1',
            post_id: 'post-1',
            parent_comment_id: null,
            user_id: 'user-2',
            author: 'Sam',
            text: 'Nice plan @Alex',
            created_at: '2026-02-12T10:00:00.000Z',
          },
        ],
      }),
    ]

    const notifications = buildNotifications({
      posts,
      reports: [],
      userId: 'user-1',
      nickname: 'Alex',
      nowMs: new Date('2026-02-13T10:00:00.000Z').getTime(),
    })

    expect(notifications.map((item) => item.type)).toEqual(['comment', 'mention'])
  })

  it('filters out stale notifications beyond retention', () => {
    const posts = [
      createPost({
        user_id: 'user-1',
        comments: [
          {
            id: 'comment-1',
            post_id: 'post-1',
            parent_comment_id: null,
            user_id: 'user-2',
            author: 'Sam',
            text: 'hello',
            created_at: '2026-01-01T10:00:00.000Z',
          },
        ],
      }),
    ]

    const notifications = buildNotifications({
      posts,
      reports: [createReport({ reviewed_at: '2026-01-02T10:00:00.000Z' })],
      userId: 'user-1',
      nickname: 'Alex',
      retentionDays: 7,
      nowMs: new Date('2026-02-13T10:00:00.000Z').getTime(),
    })

    expect(notifications).toEqual([])
  })
})
