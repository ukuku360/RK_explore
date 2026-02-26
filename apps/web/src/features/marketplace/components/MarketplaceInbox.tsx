import { formatDateTime } from '../../../lib/formatters'
import type { MarketplaceChatThread } from '../../../types/domain'

type MarketplaceInboxProps = {
  threads: MarketplaceChatThread[]
  selectedThreadId: string | null
  currentUserId: string
  isAdmin: boolean
  isLoading: boolean
  onSelectThread: (threadId: string) => void
}

function getThreadTitle(
  thread: MarketplaceChatThread,
  currentUserId: string,
  isAdmin: boolean,
): string {
  if (isAdmin) {
    return `${thread.seller_nickname} ⇄ ${thread.buyer_nickname}`
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
  onSelectThread,
}: MarketplaceInboxProps) {
  return (
    <section className="rk-marketplace-inbox rk-card">
      <div className="rk-marketplace-chat-head">
        <h3>Private Chats</h3>
        <span>{threads.length}</span>
      </div>
      {isLoading ? <p className="rk-feed-note">Loading chats...</p> : null}
      {!isLoading && threads.length === 0 ? (
        <p className="rk-feed-note">
          {isAdmin
            ? 'No marketplace chat threads yet.'
            : 'No private chats yet. Use Message on a listing or bid.'}
        </p>
      ) : null}
      <div className="rk-marketplace-thread-list">
        {threads.map((thread) => (
          <button
            key={thread.id}
            type="button"
            className={`rk-marketplace-thread-row ${selectedThreadId === thread.id ? 'rk-marketplace-thread-row-active' : ''}`}
            onClick={() => onSelectThread(thread.id)}
          >
            <strong>{getThreadTitle(thread, currentUserId, isAdmin)}</strong>
            <span>{thread.post_title}</span>
            <small>
              {thread.last_message_preview ?? 'No messages yet'}
              {thread.last_message_at ? ` · ${formatDateTime(thread.last_message_at)}` : ''}
            </small>
          </button>
        ))}
      </div>
    </section>
  )
}
