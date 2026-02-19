import { describe, expect, it } from 'vitest'

import type { CommunityPost } from '../../../../types/domain'
import { filterCommunityPosts, getCommunityOverview, sortCommunityPosts } from '../discovery'

function createPost(overrides?: Partial<CommunityPost>): CommunityPost {
  return {
    id: 'post-1',
    user_id: 'u1',
    author: 'Alice',
    content: 'Weekend market cleanup',
    created_at: '2026-02-17T10:00:00.000Z',
    updated_at: '2026-02-17T10:00:00.000Z',
    likes_count: 1,
    comments_count: 0,
    has_liked: false,
    ...overrides,
  }
}

describe('community discovery helpers', () => {
  it('filters by tab and search text', () => {
    const posts = [
      createPost({ id: 'my-post', user_id: 'u1', content: 'Need boxes' }),
      createPost({ id: 'needs-reply', user_id: 'u2', content: 'Any moving tips?', comments_count: 0 }),
      createPost({ id: 'answered', user_id: 'u3', content: 'Found bike pump', comments_count: 2 }),
    ]

    const myPosts = filterCommunityPosts(posts, {
      tab: 'my_posts',
      currentUserId: 'u1',
      searchText: '',
    })
    expect(myPosts.map((post) => post.id)).toEqual(['my-post'])

    const needsReply = filterCommunityPosts(posts, {
      tab: 'needs_reply',
      currentUserId: 'u1',
      searchText: '',
    })
    expect(needsReply.map((post) => post.id)).toEqual(['my-post', 'needs-reply'])

    const searchResult = filterCommunityPosts(posts, {
      tab: 'all',
      currentUserId: 'u1',
      searchText: 'bike',
    })
    expect(searchResult.map((post) => post.id)).toEqual(['answered'])
  })

  it('sorts popular posts by weighted engagement and recency tiebreaker', () => {
    const posts = [
      createPost({ id: 'recent-low', likes_count: 1, comments_count: 1, created_at: '2026-02-17T12:00:00.000Z' }),
      createPost({ id: 'older-high', likes_count: 4, comments_count: 2, created_at: '2026-02-17T09:00:00.000Z' }),
      createPost({ id: 'recent-high', likes_count: 2, comments_count: 2, created_at: '2026-02-17T13:00:00.000Z' }),
    ]

    const popular = sortCommunityPosts(posts, 'popular')
    expect(popular.map((post) => post.id)).toEqual(['older-high', 'recent-high', 'recent-low'])
  })

  it('builds overview metrics', () => {
    const posts = [
      createPost({ id: 'a', user_id: 'u1', likes_count: 2, comments_count: 0 }),
      createPost({ id: 'b', user_id: 'u2', likes_count: 1, comments_count: 3 }),
      createPost({ id: 'c', user_id: 'u1', likes_count: 0, comments_count: 0 }),
    ]

    const overview = getCommunityOverview(posts, 'u1')
    expect(overview).toEqual({
      totalPosts: 3,
      needsReply: 2,
      myPosts: 2,
      totalEngagements: 6,
    })
  })
})
