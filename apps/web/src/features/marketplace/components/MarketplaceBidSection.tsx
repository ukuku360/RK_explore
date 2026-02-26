import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { formatCurrency, formatDateTime } from '../../../lib/formatters'
import { INPUT_LIMITS } from '../../../lib/inputLimits'
import { queryKeys } from '../../../lib/queryKeys'
import {
  acceptMarketplaceBid,
  fetchMarketplaceBidEvents,
  fetchMarketplaceBids,
  fetchMarketplaceTransactionByPost,
  placeMarketplaceBid,
  submitMarketplaceTransactionRating,
  updateMarketplaceTransactionStatus,
} from '../../../services/marketplace/marketplace.service'
import type { MarketplacePostStatus } from '../../../types/domain'

type MarketplaceBidSectionProps = {
  postId: string
  postStatus: MarketplacePostStatus
  currentUserId: string
  currentUserLabel: string
  sellerUserId: string
  isSeller: boolean
  onOpenChatWithBidder: (params: { buyerUserId: string; buyerNickname: string }) => Promise<void> | void
}

export function MarketplaceBidSection({
  postId,
  postStatus,
  currentUserId,
  currentUserLabel,
  sellerUserId,
  isSeller,
  onOpenChatWithBidder,
}: MarketplaceBidSectionProps) {
  const queryClient = useQueryClient()
  const [draftAmount, setDraftAmount] = useState('')
  const [ratingScoreDraft, setRatingScoreDraft] = useState('5')
  const [ratingNoteDraft, setRatingNoteDraft] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const bidsQuery = useQuery({
    queryKey: queryKeys.marketplaceBids.byPost(postId),
    queryFn: () => fetchMarketplaceBids(postId),
  })
  const historyQuery = useQuery({
    queryKey: queryKeys.marketplaceBidEvents.byPost(postId),
    queryFn: () => fetchMarketplaceBidEvents(postId),
  })
  const transactionQuery = useQuery({
    queryKey: queryKeys.marketplaceTransactions.byPost(postId),
    queryFn: () => fetchMarketplaceTransactionByPost(postId),
  })

  const myBid = useMemo(
    () => (bidsQuery.data ?? []).find((bid) => bid.bidder_user_id === currentUserId) ?? null,
    [bidsQuery.data, currentUserId],
  )

  const bidMutation = useMutation({
    mutationFn: async (amount: number) => placeMarketplaceBid(postId, currentUserId, currentUserLabel, amount),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceBids.byPost(postId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceBidEvents.byPost(postId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.posts() }),
      ])
      setErrorMessage('')
      setDraftAmount('')
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save bid.')
    },
  })

  const acceptBidMutation = useMutation({
    mutationFn: async (bidId: string) => acceptMarketplaceBid(postId, bidId, sellerUserId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceTransactions.byPost(postId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.posts() }),
      ])
      setErrorMessage('')
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to accept bid.')
    },
  })

  const transactionStatusMutation = useMutation({
    mutationFn: async (status: 'completed' | 'cancelled') => {
      const transaction = transactionQuery.data
      if (!transaction) throw new Error('No active transaction found.')
      return updateMarketplaceTransactionStatus(transaction.id, status)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceTransactions.byPost(postId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.posts() }),
      ])
      setErrorMessage('')
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update transaction status.')
    },
  })

  const ratingMutation = useMutation({
    mutationFn: async (params: { actorRole: 'seller' | 'buyer'; score: number; note: string }) => {
      const transaction = transactionQuery.data
      if (!transaction) throw new Error('No transaction found to rate.')
      return submitMarketplaceTransactionRating({
        transactionId: transaction.id,
        actorRole: params.actorRole,
        score: params.score,
        note: params.note,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceTransactions.byPost(postId) })
      setErrorMessage('')
      setRatingNoteDraft('')
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save rating.')
    },
  })

  const bids = bidsQuery.data ?? []
  const bidEvents = historyQuery.data ?? []
  const transaction = transactionQuery.data
  const hasDeal = Boolean(transaction)
  const canBid = !isSeller && postStatus === 'active' && !hasDeal
  const isMessageDisabled = currentUserId === sellerUserId
  const isBidActionPending =
    bidMutation.isPending || acceptBidMutation.isPending || transactionStatusMutation.isPending || ratingMutation.isPending

  const actorRole = useMemo(() => {
    if (!transaction) return null
    if (transaction.seller_user_id === currentUserId) return 'seller'
    if (transaction.buyer_user_id === currentUserId) return 'buyer'
    return null
  }, [currentUserId, transaction])
  const ratingActorRole = actorRole === 'seller' || actorRole === 'buyer' ? actorRole : null

  const canRateNow = transaction?.status === 'completed' && Boolean(ratingActorRole)
  const myRatingScore =
    actorRole === 'seller' ? transaction?.buyer_rating_score ?? null : actorRole === 'buyer' ? transaction?.seller_rating_score ?? null : null

  return (
    <section className="rk-marketplace-bids">
      <div className="rk-marketplace-bids-head">
        <strong>Bids</strong>
        <span>{bids.length} active bids</span>
      </div>

      {transaction ? (
        <div className="rk-marketplace-deal-panel">
          <div className="rk-marketplace-deal-head">
            <strong>Deal in Progress</strong>
            <span>{transaction.status.replace('_', ' ')}</span>
          </div>
          <p>
            Accepted bid: {formatCurrency(transaction.accepted_bid_amount)} by {transaction.accepted_bidder_nickname}
          </p>
          {transaction.completed_at ? <p>Completed at {formatDateTime(transaction.completed_at)}</p> : null}
          {transaction.cancelled_at ? <p>Cancelled at {formatDateTime(transaction.cancelled_at)}</p> : null}

          {isSeller && transaction.status === 'pending_meetup' ? (
            <div className="rk-marketplace-deal-actions">
              <button
                type="button"
                className="rk-chip rk-chip-active"
                onClick={() => transactionStatusMutation.mutate('completed')}
                disabled={transactionStatusMutation.isPending}
              >
                Mark Completed
              </button>
              <button
                type="button"
                className="rk-chip"
                onClick={() => transactionStatusMutation.mutate('cancelled')}
                disabled={transactionStatusMutation.isPending}
              >
                Cancel Deal
              </button>
            </div>
          ) : null}

          {canRateNow ? (
            <div className="rk-marketplace-rating-box">
              <strong>{actorRole === 'seller' ? 'Rate Buyer' : 'Rate Seller'}</strong>
              {myRatingScore ? <p>You already rated: {myRatingScore}/5</p> : null}
              {!myRatingScore ? (
                <form
                  className="rk-marketplace-rating-form"
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (!ratingActorRole) return
                    const score = Number.parseInt(ratingScoreDraft, 10)
                    if (!Number.isInteger(score) || score < 1 || score > 5) {
                      setErrorMessage('Choose a score between 1 and 5.')
                      return
                    }
                    ratingMutation.mutate({
                      actorRole: ratingActorRole,
                      score,
                      note: ratingNoteDraft,
                    })
                  }}
                >
                  <label className="rk-auth-label">
                    Score
                    <select
                      className="rk-auth-input"
                      value={ratingScoreDraft}
                      onChange={(event) => setRatingScoreDraft(event.target.value)}
                      disabled={ratingMutation.isPending}
                    >
                      <option value="5">5 - Excellent</option>
                      <option value="4">4 - Good</option>
                      <option value="3">3 - Okay</option>
                      <option value="2">2 - Poor</option>
                      <option value="1">1 - Bad</option>
                    </select>
                  </label>
                  <label className="rk-auth-label">
                    Note (optional)
                    <textarea
                      rows={2}
                      className="rk-auth-input rk-textarea"
                      value={ratingNoteDraft}
                      maxLength={INPUT_LIMITS.marketplace_rating_note}
                      onChange={(event) => setRatingNoteDraft(event.target.value)}
                      disabled={ratingMutation.isPending}
                    />
                  </label>
                  <div className="rk-marketplace-rating-meta">
                    <span>{ratingNoteDraft.trim().length}/{INPUT_LIMITS.marketplace_rating_note}</span>
                    <button
                      type="submit"
                      className="rk-button rk-button-small"
                      disabled={ratingMutation.isPending}
                    >
                      {ratingMutation.isPending ? 'Saving...' : 'Save Rating'}
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          ) : null}

          {transaction.seller_rating_score ? (
            <p>Buyer rated seller: {transaction.seller_rating_score}/5</p>
          ) : null}
          {transaction.buyer_rating_score ? (
            <p>Seller rated buyer: {transaction.buyer_rating_score}/5</p>
          ) : null}
        </div>
      ) : null}

      {bidsQuery.isLoading ? <p className="rk-feed-note">Loading bids...</p> : null}
      {bids.map((bid) => {
        const isMine = bid.bidder_user_id === currentUserId
        const canAcceptBid = isSeller && !isMine && !hasDeal && postStatus === 'active'

        return (
          <div key={bid.id} className={`rk-marketplace-bid-row ${isMine ? 'rk-marketplace-bid-row-mine' : ''}`}>
            <div>
              <strong>{bid.bidder_nickname}</strong>
              <span>{formatDateTime(bid.updated_at)}</span>
            </div>
            <div className="rk-marketplace-bid-row-right">
              <strong>{formatCurrency(bid.amount)}</strong>
              {isSeller && !isMine ? (
                <button
                  type="button"
                  className="rk-chip"
                  onClick={() => {
                    void onOpenChatWithBidder({
                      buyerUserId: bid.bidder_user_id,
                      buyerNickname: bid.bidder_nickname,
                    })
                  }}
                  disabled={isMessageDisabled || isBidActionPending}
                >
                  Message
                </button>
              ) : null}
              {canAcceptBid ? (
                <button
                  type="button"
                  className="rk-chip rk-chip-active"
                  onClick={() => acceptBidMutation.mutate(bid.id)}
                  disabled={acceptBidMutation.isPending}
                >
                  Accept Bid
                </button>
              ) : null}
            </div>
          </div>
        )
      })}
      {!bidsQuery.isLoading && bids.length === 0 ? <p className="rk-feed-note">No bids yet.</p> : null}

      {canBid ? (
        <form
          className="rk-marketplace-bid-form"
          onSubmit={(event) => {
            event.preventDefault()
            const amount = Number.parseFloat(draftAmount)
            if (!Number.isFinite(amount) || amount <= 0) {
              setErrorMessage('Enter a valid bid above 0.')
              return
            }
            bidMutation.mutate(amount)
          }}
        >
          <label className="rk-auth-label">
            {myBid ? 'Update your bid' : 'Place a bid'}
            <input
              type="number"
              className="rk-auth-input"
              min={0}
              step="0.01"
              placeholder={myBid ? String(myBid.amount) : '0.00'}
              value={draftAmount}
              onChange={(event) => setDraftAmount(event.target.value)}
              disabled={bidMutation.isPending}
            />
          </label>
          <button
            type="submit"
            className="rk-button rk-button-secondary rk-button-small"
            disabled={bidMutation.isPending}
          >
            {myBid ? 'Update Bid' : 'Place Bid'}
          </button>
        </form>
      ) : null}

      {postStatus !== 'active' && !hasDeal ? (
        <p className="rk-feed-note">Bidding is closed while this listing is {postStatus}.</p>
      ) : null}

      <details className="rk-marketplace-bid-history">
        <summary>Bid history ({bidEvents.length})</summary>
        <div className="rk-marketplace-bid-history-list">
          {historyQuery.isLoading ? <p className="rk-feed-note">Loading bid history...</p> : null}
          {!historyQuery.isLoading && bidEvents.length === 0 ? (
            <p className="rk-feed-note">No bid changes yet.</p>
          ) : null}
          {bidEvents.map((event) => (
            <div key={event.id} className="rk-marketplace-bid-history-row">
              <strong>{event.bidder_nickname}</strong>
              <span>{formatCurrency(event.amount)}</span>
              <span>{event.event_type === 'created' ? 'opened bid' : 'updated bid'}</span>
              <span>{formatDateTime(event.created_at)}</span>
            </div>
          ))}
        </div>
      </details>
      {errorMessage ? <p className="rk-auth-message rk-auth-error">{errorMessage}</p> : null}
    </section>
  )
}
