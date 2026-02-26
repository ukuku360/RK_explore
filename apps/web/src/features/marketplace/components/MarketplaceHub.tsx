import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuthSession } from '../../../app/providers/auth-session-context'
import { queryKeys } from '../../../lib/queryKeys'
import { invalidateAfterMarketplaceMutation } from '../../../lib/queryInvalidation'
import {
  getOrCreateMarketplaceChatThread,
  listMarketplaceChatMessages,
  listMarketplaceChatThreads,
  sendMarketplaceChatMessage,
} from '../../../services/marketplace/marketplace-chat.service'
import { uploadMarketplaceImage } from '../../../services/marketplace/marketplace-image.service'
import {
  createMarketplacePost,
  deleteMarketplacePost,
  fetchMarketplacePosts,
  updateMarketplacePost,
} from '../../../services/marketplace/marketplace.service'
import type { MarketplacePost, MarketplacePostStatus } from '../../../types/domain'
import { MarketplaceChatWindow } from './MarketplaceChatWindow'
import { MarketplaceFeed } from './MarketplaceFeed'
import { MarketplaceInbox } from './MarketplaceInbox'
import type { MarketplacePostDraft } from './CreateMarketplacePost'

export function MarketplaceHub() {
  const { user } = useAuthSession()
  const queryClient = useQueryClient()

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusTone, setStatusTone] = useState<'idle' | 'success' | 'error'>('idle')
  const [isCreating, setIsCreating] = useState(false)
  const [pendingStatusByPostId, setPendingStatusByPostId] = useState<Record<string, boolean>>({})
  const [pendingDeleteByPostId, setPendingDeleteByPostId] = useState<Record<string, boolean>>({})
  const [isSendingMessage, setIsSendingMessage] = useState(false)

  const postsQuery = useQuery({
    queryKey: queryKeys.marketplace.posts(),
    queryFn: () => fetchMarketplacePosts(user?.id),
    enabled: Boolean(user),
  })
  const threadsQuery = useQuery({
    queryKey: queryKeys.marketplaceChats.threads(user?.id ?? 'anonymous'),
    queryFn: () => listMarketplaceChatThreads(user!.id, user!.isAdmin),
    enabled: Boolean(user),
  })

  const selectedThread = useMemo(
    () => (threadsQuery.data ?? []).find((thread) => thread.id === selectedThreadId) ?? null,
    [selectedThreadId, threadsQuery.data],
  )

  const messagesQuery = useQuery({
    queryKey: selectedThreadId
      ? queryKeys.marketplaceChats.messages(selectedThreadId)
      : ['marketplace-chats', 'messages', 'none'],
    queryFn: () => listMarketplaceChatMessages(selectedThreadId!),
    enabled: Boolean(user && selectedThreadId),
  })

  useEffect(() => {
    if (!threadsQuery.data || threadsQuery.data.length === 0) {
      setSelectedThreadId(null)
      return
    }
    if (selectedThreadId && threadsQuery.data.some((thread) => thread.id === selectedThreadId)) return
    setSelectedThreadId(threadsQuery.data[0].id)
  }, [selectedThreadId, threadsQuery.data])

  async function handleCreatePost(draft: MarketplacePostDraft): Promise<void> {
    if (!user) throw new Error('Please log in first.')

    setIsCreating(true)
    try {
      const imageUrl = draft.imageFile
        ? await uploadMarketplaceImage(user.id, draft.imageFile)
        : null

      await createMarketplacePost({
        sellerUserId: user.id,
        sellerNickname: user.label,
        title: draft.title,
        description: draft.description,
        askingPrice: draft.askingPrice,
        imageUrl,
      })

      await invalidateAfterMarketplaceMutation(queryClient)
      setStatusTone('success')
      setStatusMessage('Listing posted to marketplace.')
    } catch (error) {
      setStatusTone('error')
      setStatusMessage(error instanceof Error ? error.message : 'Failed to post listing.')
      throw error
    } finally {
      setIsCreating(false)
    }
  }

  async function handleDeletePost(postId: string): Promise<void> {
    if (!user) return
    if (!window.confirm('Delete this listing? This cannot be undone.')) return

    setPendingDeleteByPostId((previous) => ({ ...previous, [postId]: true }))
    try {
      await deleteMarketplacePost(postId, user.id)
      await invalidateAfterMarketplaceMutation(queryClient)
      setStatusTone('success')
      setStatusMessage('Listing deleted.')
    } catch (error) {
      setStatusTone('error')
      setStatusMessage(error instanceof Error ? error.message : 'Failed to delete listing.')
    } finally {
      setPendingDeleteByPostId((previous) => ({ ...previous, [postId]: false }))
    }
  }

  async function handleUpdateStatus(postId: string, status: MarketplacePostStatus): Promise<void> {
    if (!user) return

    setPendingStatusByPostId((previous) => ({ ...previous, [postId]: true }))
    try {
      await updateMarketplacePost(postId, user.id, { status })
      await invalidateAfterMarketplaceMutation(queryClient)
      setStatusTone('success')
      setStatusMessage(`Listing marked as ${status}.`)
    } catch (error) {
      setStatusTone('error')
      setStatusMessage(error instanceof Error ? error.message : 'Failed to update listing status.')
    } finally {
      setPendingStatusByPostId((previous) => ({ ...previous, [postId]: false }))
    }
  }

  async function openThreadForParticipants(
    post: MarketplacePost,
    buyer: { userId: string; nickname: string },
  ): Promise<void> {
    if (!user) return

    try {
      const thread = await getOrCreateMarketplaceChatThread({
        currentUserId: user.id,
        postId: post.id,
        postTitle: post.title,
        postImageUrl: post.image_url,
        sellerUserId: post.seller_user_id,
        sellerNickname: post.seller_nickname,
        buyerUserId: buyer.userId,
        buyerNickname: buyer.nickname,
      })
      await queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceChats.all })
      setSelectedThreadId(thread.id)
      setStatusTone('success')
      setStatusMessage('Private chat opened.')
    } catch (error) {
      setStatusTone('error')
      setStatusMessage(error instanceof Error ? error.message : 'Failed to open private chat.')
    }
  }

  async function handleOpenChatWithSeller(post: MarketplacePost): Promise<void> {
    if (!user) return
    await openThreadForParticipants(post, { userId: user.id, nickname: user.label })
  }

  async function handleOpenChatWithBidder(
    post: MarketplacePost,
    params: { buyerUserId: string; buyerNickname: string },
  ): Promise<void> {
    await openThreadForParticipants(post, {
      userId: params.buyerUserId,
      nickname: params.buyerNickname,
    })
  }

  async function handleSendMessage(content: string): Promise<void> {
    if (!user || !selectedThread) return
    if (user.isAdmin) return

    setIsSendingMessage(true)
    try {
      await sendMarketplaceChatMessage({
        threadId: selectedThread.id,
        senderUserId: user.id,
        senderNickname: user.label,
        content,
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceChats.messages(selectedThread.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceChats.threads(user.id) }),
      ])
    } catch (error) {
      setStatusTone('error')
      setStatusMessage(error instanceof Error ? error.message : 'Failed to send message.')
      throw error
    } finally {
      setIsSendingMessage(false)
    }
  }

  if (!user) {
    return (
      <section className="rk-page">
        <h1>Marketplace</h1>
        <p>Please log in to view marketplace listings.</p>
      </section>
    )
  }

  return (
    <div className="rk-marketplace-layout">
      <div className="rk-marketplace-main">
        {postsQuery.isLoading ? <div className="rk-loading">Loading marketplace...</div> : null}
        {postsQuery.error instanceof Error ? (
          <p className="rk-auth-message rk-auth-error">{postsQuery.error.message}</p>
        ) : null}
        {!postsQuery.isLoading && !(postsQuery.error instanceof Error) ? (
          <MarketplaceFeed
            posts={postsQuery.data ?? []}
            currentUserId={user.id}
            currentUserLabel={user.label}
            isCreating={isCreating}
            statusMessage={statusMessage}
            statusTone={statusTone}
            pendingStatusByPostId={pendingStatusByPostId}
            pendingDeleteByPostId={pendingDeleteByPostId}
            onCreatePost={handleCreatePost}
            onDeletePost={handleDeletePost}
            onUpdatePostStatus={handleUpdateStatus}
            onOpenChatWithSeller={handleOpenChatWithSeller}
            onOpenChatWithBidder={handleOpenChatWithBidder}
          />
        ) : null}
      </div>

      <aside className="rk-marketplace-rail">
        <MarketplaceInbox
          threads={threadsQuery.data ?? []}
          selectedThreadId={selectedThreadId}
          currentUserId={user.id}
          isAdmin={user.isAdmin}
          isLoading={threadsQuery.isLoading}
          onSelectThread={setSelectedThreadId}
        />
        <MarketplaceChatWindow
          thread={selectedThread}
          messages={messagesQuery.data ?? []}
          isLoading={messagesQuery.isLoading}
          isSending={isSendingMessage}
          canSend={!user.isAdmin}
          currentUserId={user.id}
          onSendMessage={handleSendMessage}
        />
      </aside>
    </div>
  )
}
