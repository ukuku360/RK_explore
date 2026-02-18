import { describe, expect, it } from 'vitest'

import { getMyActivityPosts, hasPersonalizationData, rankRecommendedPosts } from '../personalization'
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
  } as Post
}

describe('personalization helpers', () => {
  it('detects whether the viewer has personalization signals', () => {
    const posts = [
      createPost({
        votes: [{ id: 'vote-1', post_id: 'post-1', user_id: 'u1', created_at: '2026-02-14T10:00:00.000Z' }],
      }),
    ]

    expect(hasPersonalizationData(posts, 'u1')).toBe(true)
    expect(hasPersonalizationData(posts, 'u2')).toBe(false)
  })

  it('collects my-activity posts from created, voted, and RSVPed entries', () => {
    const posts = [
      createPost({ id: 'created-by-me', user_id: 'u1' }),
      createPost({
        id: 'voted-by-me',
        votes: [{ id: 'vote-1', post_id: 'voted-by-me', user_id: 'u1', created_at: '2026-02-14T10:00:00.000Z' }],
      }),
      createPost({
        id: 'rsvped-by-me',
        rsvps: [{ id: 'rsvp-1', post_id: 'rsvped-by-me', user_id: 'u1', created_at: '2026-02-14T10:00:00.000Z' }],
      }),
      createPost({ id: 'other' }),
    ]

    const result = getMyActivityPosts(posts, 'u1').map((post) => post.id)
    expect(result).toEqual(['created-by-me', 'voted-by-me', 'rsvped-by-me'])
  })

  it('ranks recommended posts with user signal priority', () => {
    const nowMs = new Date('2026-02-14T12:00:00.000Z').getTime()
    const posts = [
      createPost({
        id: 'voted',
        votes: [{ id: 'vote-1', post_id: 'voted', user_id: 'u1', created_at: '2026-02-14T10:00:00.000Z' }],
      }),
      createPost({
        id: 'fresh',
        created_at: '2026-02-14T11:50:00.000Z',
      }),
      createPost({
        id: 'neutral',
      }),
    ]

    const ranked = rankRecommendedPosts(posts, 'u1', true, nowMs)
    expect(ranked.rankedPosts[0]?.id).toBe('voted')
    expect(ranked.metaByPostId.voted?.reason).toContain('voted')
  })
})
