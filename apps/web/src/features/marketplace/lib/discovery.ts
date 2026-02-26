import type { MarketplacePost, MarketplacePostStatus } from '../../../types/domain'

export const MARKETPLACE_SORT_OPTIONS = ['newest', 'highest_bid', 'price_low', 'price_high'] as const
export type MarketplaceSortOption = (typeof MARKETPLACE_SORT_OPTIONS)[number]

export type MarketplaceFilterParams = {
  status: MarketplacePostStatus | 'all'
  searchText: string
  mineOnly: boolean
  currentUserId?: string
}

export function filterMarketplacePosts(
  posts: MarketplacePost[],
  params: MarketplaceFilterParams,
): MarketplacePost[] {
  const normalizedSearch = params.searchText.trim().toLowerCase()

  return posts.filter((post) => {
    if (params.status !== 'all' && post.status !== params.status) {
      return false
    }

    if (params.mineOnly && params.currentUserId && post.seller_user_id !== params.currentUserId) {
      return false
    }

    if (!normalizedSearch) return true

    const searchableText =
      `${post.title} ${post.description} ${post.seller_nickname} ${post.highest_bidder_nickname ?? ''}`.toLowerCase()
    return searchableText.includes(normalizedSearch)
  })
}

export function sortMarketplacePosts(
  posts: MarketplacePost[],
  sort: MarketplaceSortOption,
): MarketplacePost[] {
  const sorted = [...posts]

  if (sort === 'highest_bid') {
    sorted.sort((a, b) => {
      const aBid = a.highest_bid_amount ?? 0
      const bBid = b.highest_bid_amount ?? 0
      const bidGap = bBid - aBid
      if (bidGap !== 0) return bidGap
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return sorted
  }

  if (sort === 'price_low') {
    sorted.sort((a, b) => {
      const gap = a.asking_price - b.asking_price
      if (gap !== 0) return gap
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return sorted
  }

  if (sort === 'price_high') {
    sorted.sort((a, b) => {
      const gap = b.asking_price - a.asking_price
      if (gap !== 0) return gap
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return sorted
  }

  sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return sorted
}

export function getMarketplaceOverview(posts: MarketplacePost[]) {
  return posts.reduce(
    (overview, post) => {
      overview.total += 1
      overview.totalBids += post.bids_count
      overview.totalComments += post.comments_count

      if (post.status === 'active') overview.active += 1
      if (post.status === 'reserved') overview.reserved += 1
      if (post.status === 'sold') overview.sold += 1

      return overview
    },
    {
      total: 0,
      active: 0,
      reserved: 0,
      sold: 0,
      totalBids: 0,
      totalComments: 0,
    },
  )
}
