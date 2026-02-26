import { describe, expect, it } from 'vitest'

import type { MarketplacePost } from '../../../../types/domain'
import {
  filterMarketplacePosts,
  getMarketplaceOverview,
  sortMarketplacePosts,
} from '../discovery'

function createPost(overrides?: Partial<MarketplacePost>): MarketplacePost {
  return {
    id: 'post-1',
    seller_user_id: 'seller-1',
    seller_nickname: 'Swan',
    title: 'Desk lamp',
    description: 'Bright desk lamp, warm light.',
    asking_price: 30,
    image_url: '/lamp.png',
    status: 'active',
    created_at: '2026-02-20T09:00:00.000Z',
    updated_at: '2026-02-20T09:00:00.000Z',
    bids_count: 1,
    comments_count: 2,
    highest_bid_amount: 25,
    highest_bidder_nickname: 'Nate',
    my_bid_amount: null,
    ...overrides,
  }
}

describe('marketplace discovery helpers', () => {
  it('filters by status, search text, and ownership', () => {
    const posts = [
      createPost({ id: 'active-1', seller_user_id: 'u1', title: 'Lamp', status: 'active' }),
      createPost({ id: 'sold-1', seller_user_id: 'u2', title: 'Chair', status: 'sold' }),
      createPost({ id: 'active-2', seller_user_id: 'u2', title: 'Monitor', status: 'active' }),
    ]

    const activeOnly = filterMarketplacePosts(posts, {
      status: 'active',
      searchText: '',
      mineOnly: false,
      currentUserId: 'u1',
    })
    expect(activeOnly.map((post) => post.id)).toEqual(['active-1', 'active-2'])

    const mine = filterMarketplacePosts(posts, {
      status: 'all',
      searchText: '',
      mineOnly: true,
      currentUserId: 'u1',
    })
    expect(mine.map((post) => post.id)).toEqual(['active-1'])

    const searched = filterMarketplacePosts(posts, {
      status: 'all',
      searchText: 'chair',
      mineOnly: false,
      currentUserId: 'u1',
    })
    expect(searched.map((post) => post.id)).toEqual(['sold-1'])
  })

  it('sorts by highest bid and price', () => {
    const posts = [
      createPost({ id: 'p1', highest_bid_amount: 80, asking_price: 100, created_at: '2026-02-20T10:00:00.000Z' }),
      createPost({ id: 'p2', highest_bid_amount: 120, asking_price: 90, created_at: '2026-02-20T09:00:00.000Z' }),
      createPost({ id: 'p3', highest_bid_amount: null, asking_price: 40, created_at: '2026-02-20T11:00:00.000Z' }),
    ]

    expect(sortMarketplacePosts(posts, 'highest_bid').map((post) => post.id)).toEqual(['p2', 'p1', 'p3'])
    expect(sortMarketplacePosts(posts, 'price_low').map((post) => post.id)).toEqual(['p3', 'p2', 'p1'])
    expect(sortMarketplacePosts(posts, 'price_high').map((post) => post.id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('builds marketplace overview metrics', () => {
    const posts = [
      createPost({ status: 'active', bids_count: 2, comments_count: 1 }),
      createPost({ status: 'reserved', bids_count: 1, comments_count: 2 }),
      createPost({ status: 'sold', bids_count: 3, comments_count: 4 }),
    ]

    expect(getMarketplaceOverview(posts)).toEqual({
      total: 3,
      active: 1,
      reserved: 1,
      sold: 1,
      totalBids: 6,
      totalComments: 7,
    })
  })
})
