import { useMemo, useState } from 'react'

import type { MarketplacePost, MarketplacePostStatus } from '../../../types/domain'
import {
  MARKETPLACE_SORT_OPTIONS,
  filterMarketplacePosts,
  getMarketplaceOverview,
  sortMarketplacePosts,
  type MarketplaceSortOption,
} from '../lib/discovery'
import { CreateMarketplacePost, type MarketplacePostDraft } from './CreateMarketplacePost'
import { MarketplacePostCard } from './MarketplacePostCard'

type MarketplaceFeedProps = {
  posts: MarketplacePost[]
  currentUserId: string
  currentUserLabel: string
  isCreating: boolean
  statusMessage: string
  statusTone: 'idle' | 'success' | 'error'
  pendingStatusByPostId: Record<string, boolean>
  pendingDeleteByPostId: Record<string, boolean>
  onCreatePost: (draft: MarketplacePostDraft) => Promise<void>
  onDeletePost: (postId: string) => Promise<void>
  onUpdatePostStatus: (postId: string, status: MarketplacePostStatus) => Promise<void>
  onOpenChatWithSeller: (post: MarketplacePost) => Promise<void>
  onOpenChatWithBidder: (
    post: MarketplacePost,
    params: { buyerUserId: string; buyerNickname: string },
  ) => Promise<void>
}

const MARKETPLACE_STATUS_FILTERS: ReadonlyArray<'all' | MarketplacePostStatus> = [
  'all',
  'active',
  'reserved',
  'sold',
]

function getSortLabel(option: MarketplaceSortOption): string {
  if (option === 'newest') return 'Newest'
  if (option === 'highest_bid') return 'Highest Bid'
  if (option === 'price_low') return 'Price Low'
  return 'Price High'
}

function getStatusLabel(status: 'all' | MarketplacePostStatus): string {
  if (status === 'all') return 'All'
  if (status === 'active') return 'Open'
  if (status === 'reserved') return 'Reserved'
  return 'Sold'
}

export function MarketplaceFeed({
  posts,
  currentUserId,
  currentUserLabel,
  isCreating,
  statusMessage,
  statusTone,
  pendingStatusByPostId,
  pendingDeleteByPostId,
  onCreatePost,
  onDeletePost,
  onUpdatePostStatus,
  onOpenChatWithSeller,
  onOpenChatWithBidder,
}: MarketplaceFeedProps) {
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | MarketplacePostStatus>('all')
  const [sortOption, setSortOption] = useState<MarketplaceSortOption>('newest')
  const [mineOnly, setMineOnly] = useState(false)

  const overview = useMemo(() => getMarketplaceOverview(posts), [posts])
  const filteredPosts = useMemo(
    () =>
      filterMarketplacePosts(posts, {
        searchText,
        status: statusFilter,
        mineOnly,
        currentUserId,
      }),
    [currentUserId, mineOnly, posts, searchText, statusFilter],
  )
  const visiblePosts = useMemo(
    () => sortMarketplacePosts(filteredPosts, sortOption),
    [filteredPosts, sortOption],
  )

  return (
    <div className="rk-marketplace-feed">
      <CreateMarketplacePost isSubmitting={isCreating} onSubmit={onCreatePost} />

      {statusMessage ? (
        <p className={statusTone === 'error' ? 'rk-auth-message rk-auth-error' : 'rk-auth-message rk-auth-success'}>
          {statusMessage}
        </p>
      ) : null}

      <section className="rk-marketplace-discovery rk-filter-toolbar">
        <div className="rk-marketplace-overview">
          <div className="rk-community-metric">
            <strong>{overview.total}</strong>
            <span>Listings</span>
          </div>
          <div className="rk-community-metric">
            <strong>{overview.active}</strong>
            <span>Open</span>
          </div>
          <div className="rk-community-metric">
            <strong>{overview.totalBids}</strong>
            <span>Total Bids</span>
          </div>
          <div className="rk-community-metric">
            <strong>{overview.sold}</strong>
            <span>Sold</span>
          </div>
        </div>

        <div className="rk-discovery">
          <input
            className="rk-post-input"
            placeholder="Search listings, sellers, or top bidders..."
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
        </div>

        <div className="rk-marketplace-filter-row">
          <div className="rk-discovery-chips">
            {MARKETPLACE_STATUS_FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                className={`rk-chip ${statusFilter === status ? 'rk-chip-active' : ''}`}
                onClick={() => setStatusFilter(status)}
              >
                {getStatusLabel(status)}
              </button>
            ))}
          </div>
          <div className="rk-discovery-chips">
            {MARKETPLACE_SORT_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={`rk-chip ${sortOption === option ? 'rk-chip-active' : ''}`}
                onClick={() => setSortOption(option)}
              >
                {getSortLabel(option)}
              </button>
            ))}
            <button
              type="button"
              className={`rk-chip ${mineOnly ? 'rk-chip-active' : ''}`}
              onClick={() => setMineOnly((previous) => !previous)}
            >
              My Listings
            </button>
          </div>
        </div>
        <p className="rk-feed-note">Showing {visiblePosts.length} listings</p>
      </section>

      <div className="rk-marketplace-list">
        {visiblePosts.length === 0 ? (
          <div className="rk-empty-state">
            <strong>No listings found</strong>
            <p>Try another filter or be the first to list an item.</p>
          </div>
        ) : (
          visiblePosts.map((post) => (
            <MarketplacePostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              currentUserLabel={currentUserLabel}
              isStatusUpdating={Boolean(pendingStatusByPostId[post.id])}
              isDeletePending={Boolean(pendingDeleteByPostId[post.id])}
              onDeletePost={onDeletePost}
              onUpdateStatus={onUpdatePostStatus}
              onOpenChatWithSeller={onOpenChatWithSeller}
              onOpenChatWithBidder={onOpenChatWithBidder}
            />
          ))
        )}
      </div>
    </div>
  )
}
