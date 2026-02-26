import { useState } from 'react'

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
}

function getStatusLabel(status: MarketplacePostStatus): string {
  if (status === 'active') return 'Open'
  if (status === 'reserved') return 'Reserved'
  return 'Sold'
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
}: MarketplacePostCardProps) {
  const [isBidsOpen, setIsBidsOpen] = useState(false)
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)

  const isSeller = post.seller_user_id === currentUserId

  return (
    <article className="rk-marketplace-card rk-card">
      <div className="rk-marketplace-card-media">
        {post.image_url ? <img src={post.image_url} alt={post.title} className="rk-marketplace-image" /> : null}
        <span className={`rk-marketplace-status rk-marketplace-status-${post.status}`}>
          {getStatusLabel(post.status)}
        </span>
      </div>

      <div className="rk-marketplace-card-body">
        <div className="rk-marketplace-card-top">
          <div>
            <h3>{post.title}</h3>
            <p className="rk-marketplace-card-meta">
              Seller {post.seller_nickname} · {formatDateTime(post.created_at)}
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

        <div className="rk-marketplace-card-actions">
          <button
            type="button"
            className={`rk-chip ${isBidsOpen ? 'rk-chip-active' : ''}`}
            onClick={() => setIsBidsOpen((previous) => !previous)}
          >
            {isBidsOpen ? 'Hide Bids' : 'Show Bids'}
          </button>
          <button
            type="button"
            className={`rk-chip ${isCommentsOpen ? 'rk-chip-active' : ''}`}
            onClick={() => setIsCommentsOpen((previous) => !previous)}
          >
            {isCommentsOpen ? 'Hide Comments' : 'Show Comments'}
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
