import { useMemo, useState } from 'react'

import { formatDateTime } from '../../../lib/formatters'
import type { MarketplaceChatThread } from '../../../types/domain'

type MarketplaceInboxProps = {
  threads: MarketplaceChatThread[]
  selectedThreadId: string | null
  currentUserId: string
  isAdmin: boolean
  isLoading: boolean
  threadHasNewActivityById: Record<string, boolean>
  newThreadCount: number
  onSelectThread: (threadId: string) => void
  onMarkAllRead: () => void
}

function getThreadTitle(
  thread: MarketplaceChatThread,
  currentUserId: string,
  isAdmin: boolean,
): string {
  if (isAdmin) {
    return `${thread.seller_nickname} <-> ${thread.buyer_nickname}`
  }

  const isSeller = thread.seller_user_id === currentUserId
  return isSeller ? thread.buyer_nickname : thread.seller_nickname
}

export function MarketplaceInbox({
  threads,
  selectedThreadId,
  currentUserId,
  isAdmin,
  isLoading,
  threadHasNewActivityById,
  newThreadCount,
  onSelectThread,
  onMarkAllRead,
}: MarketplaceInboxProps) {
  const [showNewOnly, setShowNewOnly] = useState(false)

  const visibleThreads = useMemo(() => {
    if (!showNewOnly) return threads
    return threads.filter((thread) => threadHasNewActivityById[thread.id])
  }, [showNewOnly, threadHasNewActivityById, threads])

  return (
    <section className="rk-marketplace-inbox rk-card">
      <div className="rk-marketplace-chat-head">
        <h3>Private Chats</h3>
        <div className="rk-marketplace-chat-head-meta">
          <span>{threads.length}</span>
          {newThreadCount > 0 ? <span className="rk-marketplace-new-pill">{newThreadCount} new</span> : null}
        </div>
      </div>

      <div className="rk-marketplace-thread-filters">
        <button
          type="button"
          className={`rk-chip ${!showNewOnly ? 'rk-chip-active' : ''}`}
          onClick={() => setShowNewOnly(false)}
        >
          All
        </button>
        <button
          type="button"
          className={`rk-chip ${showNewOnly ? 'rk-chip-active' : ''}`}
          onClick={() => setShowNewOnly(true)}
          disabled={newThreadCount === 0}
        >
          New
        </button>
        {newThreadCount > 0 ? (
          <button type="button" className="rk-chip" onClick={onMarkAllRead}>
            Mark all read
          </button>
        ) : null}
      </div>

      {isLoading ? <p className="rk-feed-note">Loading chats...</p> : null}
      {!isLoading && threads.length === 0 ? (
        <p className="rk-feed-note">
          {isAdmin
            ? 'No marketplace chat threads yet.'
            : 'No private chats yet. Use Message on a listing or bid.'}
        </p>
      ) : null}
      {!isLoading && threads.length > 0 && visibleThreads.length === 0 ? (
        <p className="rk-feed-note">No threads with new activity right now.</p>
      ) : null}

      <div className="rk-marketplace-thread-list">
        {visibleThreads.map((thread) => (
          <button
            key={thread.id}
            type="button"
            className={`rk-marketplace-thread-row ${selectedThreadId === thread.id ? 'rk-marketplace-thread-row-active' : ''}`}
            onClick={() => onSelectThread(thread.id)}
          >
            <div className="rk-marketplace-thread-row-head">
              <strong>{getThreadTitle(thread, currentUserId, isAdmin)}</strong>
              {threadHasNewActivityById[thread.id] ? (
                <span className="rk-marketplace-thread-pill">New</span>
              ) : null}
            </div>
            <span>{thread.post_title}</span>
            <small>
              {thread.last_message_preview ?? 'No messages yet'}
              {thread.last_message_at ? ` - ${formatDateTime(thread.last_message_at)}` : ''}
            </small>
          </button>
        ))}
      </div>
    </section>
  )
}
