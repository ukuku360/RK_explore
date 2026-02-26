import { useEffect, useMemo, useRef, useState } from 'react'

import { formatDateTime } from '../../../lib/formatters'
import { INPUT_LIMITS } from '../../../lib/inputLimits'
import type { MarketplaceChatMessage, MarketplaceChatThread } from '../../../types/domain'

type MarketplaceChatWindowProps = {
  thread: MarketplaceChatThread | null
  messages: MarketplaceChatMessage[]
  isLoading: boolean
  isSending: boolean
  canSend: boolean
  currentUserId: string
  onSendMessage: (content: string) => Promise<void> | void
}

const CHAT_QUICK_REPLIES = [
  'Is this still available?',
  'Can we meet at the lobby?',
  'I can pick this up today.',
] as const

export function MarketplaceChatWindow({
  thread,
  messages,
  isLoading,
  isSending,
  canSend,
  currentUserId,
  onSendMessage,
}: MarketplaceChatWindowProps) {
  const [draft, setDraft] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const messageListRef = useRef<HTMLDivElement | null>(null)

  const title = useMemo(() => {
    if (!thread) return 'Select a conversation'
    const isSeller = thread.seller_user_id === currentUserId
    return isSeller ? thread.buyer_nickname : thread.seller_nickname
  }, [currentUserId, thread])

  useEffect(() => {
    if (!thread) return
    const container = messageListRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
  }, [isLoading, messages.length, thread])

  return (
    <section className="rk-marketplace-chat-window rk-card">
      <div className="rk-marketplace-chat-head">
        <h3>{title}</h3>
        {thread ? <span>{thread.post_title}</span> : null}
      </div>

      {!thread ? (
        <p className="rk-feed-note">Pick a chat to open messages.</p>
      ) : (
        <>
          <div ref={messageListRef} className="rk-marketplace-message-list">
            {isLoading ? <p className="rk-feed-note">Loading messages...</p> : null}
            {!isLoading && messages.length === 0 ? (
              <p className="rk-feed-note">No messages yet. Start the conversation.</p>
            ) : null}
            {messages.map((message) => {
              const isMine = message.sender_user_id === currentUserId
              return (
                <article
                  key={message.id}
                  className={`rk-marketplace-message ${isMine ? 'rk-marketplace-message-mine' : ''}`}
                >
                  <div className="rk-marketplace-message-meta">
                    <strong>{isMine ? 'You' : message.sender_nickname}</strong>
                    <span>{formatDateTime(message.created_at)}</span>
                  </div>
                  <p>{message.content}</p>
                </article>
              )
            })}
          </div>

          {canSend ? (
            <form
              className="rk-marketplace-message-form"
              onSubmit={async (event) => {
                event.preventDefault()
                const content = draft.trim()
                if (content.length < 1) {
                  setErrorMessage('Message cannot be empty.')
                  return
                }
                setErrorMessage('')
                try {
                  await onSendMessage(content)
                  setDraft('')
                } catch (error) {
                  setErrorMessage(error instanceof Error ? error.message : 'Failed to send message.')
                }
              }}
            >
              <div className="rk-marketplace-quick-replies" role="group" aria-label="Quick reply suggestions">
                {CHAT_QUICK_REPLIES.map((reply) => (
                  <button
                    key={reply}
                    type="button"
                    className="rk-chip"
                    onClick={() => setDraft(reply)}
                    disabled={isSending}
                  >
                    {reply}
                  </button>
                ))}
              </div>
              <textarea
                className="rk-auth-input rk-textarea"
                rows={3}
                placeholder="Write a private message..."
                value={draft}
                maxLength={INPUT_LIMITS.marketplace_chat_message}
                onChange={(event) => setDraft(event.target.value)}
                disabled={isSending}
              />
              <div className="rk-marketplace-message-form-meta">
                <span>{draft.trim().length}/{INPUT_LIMITS.marketplace_chat_message}</span>
                <button
                  type="submit"
                  className="rk-button rk-button-small"
                  disabled={isSending || draft.trim().length === 0}
                >
                  {isSending ? 'Sending...' : 'Send'}
                </button>
              </div>
              {errorMessage ? <p className="rk-auth-message rk-auth-error">{errorMessage}</p> : null}
            </form>
          ) : (
            <p className="rk-feed-note">Admin monitoring mode is read-only.</p>
          )}
        </>
      )}
    </section>
  )
}
