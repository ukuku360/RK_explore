import { useMemo, useState } from 'react'

import { formatCurrency, formatDateTime } from '../../../lib/formatters'
import type { MarketplacePost, MarketplacePostStatus } from '../../../types/domain'
import { MarketplaceBidSection } from './MarketplaceBidSection'
import { MarketplaceCommentSection } from './MarketplaceCommentSection'

type MarketplacePostCardProps = {
  post: MarketplacePost
  currentUserId: string
  currentUserLabel: string
  isStatusUpdating: boolean
  isDeletePending: boolean
  onDeletePost: (postId: string) => Promise<void> | void
  onUpdateStatus: (postId: string, status: MarketplacePostStatus) => Promise<void> | void
  onOpenChatWithSeller: (post: MarketplacePost) => Promise<void> | void
  onOpenChatWithBidder: (
    post: MarketplacePost,
    params: { buyerUserId: string; buyerNickname: string },
  ) => Promise<void> | void
  isReported: boolean
  isReportPending: boolean
  isCurrentUserAdmin: boolean
  onReportToggle: (postId: string, isAlreadyReported: boolean) => Promise<void> | void
}

function getStatusLabel(status: MarketplacePostStatus): string {
  if (status === 'active') return 'Open'
  if (status === 'reserved') return 'Reserved'
  return 'Sold'
}

function getBidSignal(post: MarketplacePost, isSeller: boolean): { tone: 'neutral' | 'good' | 'warn'; text: string } | null {
  if (isSeller) return null

  if (post.status === 'sold') {
    return { tone: 'neutral', text: 'This listing is sold. Bidding is closed.' }
  }

  if (post.status === 'reserved') {
    return { tone: 'neutral', text: 'This listing is reserved right now.' }
  }

  if (post.my_bid_amount == null) {
    return { tone: 'neutral', text: 'No bid yet. Join the bidding to secure this item.' }
  }

  if (post.highest_bid_amount != null && post.my_bid_amount >= post.highest_bid_amount) {
    return { tone: 'good', text: 'You are leading this listing.' }
  }

  return { tone: 'warn', text: 'You were outbid. Update your bid to stay in the race.' }
}

export function MarketplacePostCard({
  post,
  currentUserId,
  currentUserLabel,
  isStatusUpdating,
  isDeletePending,
  onDeletePost,
  onUpdateStatus,
  onOpenChatWithSeller,
  onOpenChatWithBidder,
  isReported,
  isReportPending,
  isCurrentUserAdmin,
  onReportToggle,
}: MarketplacePostCardProps) {
  const [isBidsOpen, setIsBidsOpen] = useState(false)
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)

  const isSeller = post.seller_user_id === currentUserId
  const bidSignal = useMemo(() => getBidSignal(post, isSeller), [isSeller, post])

  const isHotListing = post.status === 'active' && post.bids_count >= 3
  const hasBidProgress = post.highest_bid_amount != null && post.asking_price > 0
  const bidProgress = hasBidProgress
    ? Math.min(100, Math.round(((post.highest_bid_amount ?? 0) / post.asking_price) * 100))
    : 0

  return (
    <article className="rk-marketplace-card rk-card">
      <div className="rk-marketplace-card-media">
        {post.image_url ? <img src={post.image_url} alt={post.title} className="rk-marketplace-image" /> : null}
        <span className={`rk-marketplace-status rk-marketplace-status-${post.status}`}>
          {getStatusLabel(post.status)}
        </span>
        {isHotListing ? <span className="rk-marketplace-hot-badge">Hot Listing</span> : null}
      </div>

      <div className="rk-marketplace-card-body">
        <div className="rk-marketplace-card-top">
          <div>
            <h3>{post.title}</h3>
            <p className="rk-marketplace-card-meta">
              Seller {post.seller_nickname} - {formatDateTime(post.created_at)}
            </p>
          </div>
          <div className="rk-marketplace-pricing">
            <strong>{formatCurrency(post.asking_price)}</strong>
            <span>Asking</span>
          </div>
        </div>

        <p className="rk-marketplace-description">{post.description}</p>

        <div className="rk-marketplace-quick-stats">
          <span>{post.bids_count} bids</span>
          <span>{post.comments_count} comments</span>
          <span>
            Highest {post.highest_bid_amount ? formatCurrency(post.highest_bid_amount) : '-'}
            {post.highest_bidder_nickname ? ` by ${post.highest_bidder_nickname}` : ''}
          </span>
        </div>

        {hasBidProgress ? (
          <div className="rk-marketplace-bid-meter">
            <div className="rk-marketplace-bid-meter-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={bidProgress}>
              <span className="rk-marketplace-bid-meter-fill" style={{ width: `${Math.max(4, bidProgress)}%` }} />
            </div>
            <p className="rk-marketplace-bid-meter-label">Top bid is {bidProgress}% of asking price</p>
          </div>
        ) : null}

        {bidSignal ? <p className={`rk-marketplace-bid-signal rk-marketplace-bid-signal-${bidSignal.tone}`}>{bidSignal.text}</p> : null}

        <div className="rk-marketplace-card-actions">
          <button
            type="button"
            className={`rk-chip ${isBidsOpen ? 'rk-chip-active' : ''}`}
            onClick={() => setIsBidsOpen((previous) => !previous)}
          >
            {isBidsOpen ? 'Hide Bids' : `Bids (${post.bids_count})`}
          </button>
          <button
            type="button"
            className={`rk-chip ${isCommentsOpen ? 'rk-chip-active' : ''}`}
            onClick={() => setIsCommentsOpen((previous) => !previous)}
          >
            {isCommentsOpen ? 'Hide Comments' : `Comments (${post.comments_count})`}
          </button>
          {!isSeller ? (
            <button
              type="button"
              className="rk-chip"
              onClick={() => {
                void onOpenChatWithSeller(post)
              }}
            >
              Message Seller
            </button>
          ) : null}
          {!isSeller && !isCurrentUserAdmin ? (
            <button
              type="button"
              className={`rk-chip ${isReported ? 'rk-chip-active' : ''}`}
              onClick={() => {
                void onReportToggle(post.id, isReported)
              }}
              disabled={isReportPending}
            >
              {isReportPending ? 'Saving...' : isReported ? 'Reported' : 'Report'}
            </button>
          ) : null}
        </div>

        {isSeller ? (
          <div className="rk-marketplace-seller-actions">
            <span>Listing Status</span>
            <div className="rk-discovery-chips">
              {(['active', 'reserved', 'sold'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`rk-chip ${post.status === status ? 'rk-chip-active' : ''}`}
                  onClick={() => onUpdateStatus(post.id, status)}
                  disabled={isStatusUpdating}
                >
                  {getStatusLabel(status)}
                </button>
              ))}
              <button
                type="button"
                className="rk-chip rk-marketplace-delete-chip"
                onClick={() => onDeletePost(post.id)}
                disabled={isDeletePending}
              >
                {isDeletePending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        ) : null}

        {isBidsOpen ? (
          <MarketplaceBidSection
            postId={post.id}
            postStatus={post.status}
            currentUserId={currentUserId}
            currentUserLabel={currentUserLabel}
            sellerUserId={post.seller_user_id}
            isSeller={isSeller}
            onOpenChatWithBidder={(params) => onOpenChatWithBidder(post, params)}
          />
        ) : null}

        {isCommentsOpen ? <MarketplaceCommentSection postId={post.id} /> : null}
      </div>
    </article>
  )
}
