import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { formatCurrency, formatDateTime } from '../../../lib/formatters'
import { queryKeys } from '../../../lib/queryKeys'
import {
  fetchMarketplaceBidEvents,
  fetchMarketplaceBids,
  placeMarketplaceBid,
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
  const [errorMessage, setErrorMessage] = useState('')

  const bidsQuery = useQuery({
    queryKey: queryKeys.marketplaceBids.byPost(postId),
    queryFn: () => fetchMarketplaceBids(postId),
  })
  const historyQuery = useQuery({
    queryKey: queryKeys.marketplaceBidEvents.byPost(postId),
    queryFn: () => fetchMarketplaceBidEvents(postId),
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

  const canBid = !isSeller && postStatus === 'active'
  const bids = bidsQuery.data ?? []
  const bidEvents = historyQuery.data ?? []
  const isMessageDisabled = currentUserId === sellerUserId

  return (
    <section className="rk-marketplace-bids">
      <div className="rk-marketplace-bids-head">
        <strong>Bids</strong>
        <span>{bids.length} active bids</span>
      </div>
      {bidsQuery.isLoading ? <p className="rk-feed-note">Loading bids...</p> : null}
      {bids.map((bid) => {
        const isMine = bid.bidder_user_id === currentUserId
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
                  disabled={isMessageDisabled}
                >
                  Message
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
      {postStatus !== 'active' ? (
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
