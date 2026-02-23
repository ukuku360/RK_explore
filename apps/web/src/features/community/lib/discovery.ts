import type { CommunityPost, CommunityPostCategory } from '../../../types/domain'

export const COMMUNITY_FEED_TABS = ['all', 'my_posts', 'needs_reply'] as const
export type CommunityFeedTab = (typeof COMMUNITY_FEED_TABS)[number]

export const COMMUNITY_SORT_OPTIONS = ['newest', 'popular'] as const
export type CommunitySortOption = (typeof COMMUNITY_SORT_OPTIONS)[number]

type FilterParams = {
  tab: CommunityFeedTab
  currentUserId?: string
  searchText: string
  category?: CommunityPostCategory | 'all'
}

export function getCommunityPopularityScore(post: CommunityPost): number {
  return post.likes_count * 2 + post.comments_count * 3
}

export function filterCommunityPosts(posts: CommunityPost[], params: FilterParams): CommunityPost[] {
  const normalizedSearch = params.searchText.trim().toLowerCase()

  let nextPosts = posts

  if (params.category && params.category !== 'all') {
    const selectedCategory = params.category
    nextPosts = nextPosts.filter((post) => post.category === selectedCategory)
  }

  if (params.tab === 'my_posts') {
    if (!params.currentUserId) {
      return []
    }

    nextPosts = nextPosts.filter((post) => post.user_id === params.currentUserId)
  } else if (params.tab === 'needs_reply') {
    nextPosts = nextPosts.filter((post) => post.comments_count === 0)
  }

  if (!normalizedSearch) {
    return nextPosts
  }

  return nextPosts.filter((post) => {
    const searchableText = `${post.author} ${post.content}`.toLowerCase()
    return searchableText.includes(normalizedSearch)
  })
}

export function sortCommunityPosts(posts: CommunityPost[], sortOption: CommunitySortOption): CommunityPost[] {
  const sorted = [...posts]

  if (sortOption === 'popular') {
    sorted.sort((a, b) => {
      const scoreGap = getCommunityPopularityScore(b) - getCommunityPopularityScore(a)
      if (scoreGap !== 0) return scoreGap
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return sorted
  }

  sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return sorted
}

export function getCommunityOverview(posts: CommunityPost[], currentUserId?: string): {
  totalPosts: number
  needsReply: number
  myPosts: number
  totalEngagements: number
} {
  return posts.reduce(
    (overview, post) => {
      overview.totalPosts += 1
      overview.totalEngagements += post.likes_count + post.comments_count

      if (post.comments_count === 0) {
        overview.needsReply += 1
      }

      if (currentUserId && post.user_id === currentUserId) {
        overview.myPosts += 1
      }

      return overview
    },
    {
      totalPosts: 0,
      needsReply: 0,
      myPosts: 0,
      totalEngagements: 0,
    },
  )
}
