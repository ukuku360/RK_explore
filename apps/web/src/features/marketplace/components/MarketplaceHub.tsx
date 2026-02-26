import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuthSession } from '../../../app/providers/auth-session-context'
import { queryKeys } from '../../../lib/queryKeys'
import {
  invalidateAfterMarketplaceMutation,
  invalidateAfterReportMutation,
} from '../../../lib/queryInvalidation'
import {
  getOrCreateMarketplaceChatThread,
  listMarketplaceChatMessages,
  listMarketplaceChatThreads,
  sendMarketplaceChatMessage,
} from '../../../services/marketplace/marketplace-chat.service'
import { uploadMarketplaceImage } from '../../../services/marketplace/marketplace-image.service'
import {
  listOpenReportsByReporter,
  clearOpenReportsByReporterTarget,
  createReport,
} from '../../../services/reports/reports.service'
import {
  createMarketplacePost,
  deleteMarketplacePost,
  fetchMarketplacePosts,
  updateMarketplacePost,
} from '../../../services/marketplace/marketplace.service'
import type { MarketplacePost, MarketplacePostStatus } from '../../../types/domain'
import { MarketplaceChatWindow } from './MarketplaceChatWindow'
import type { MarketplacePostDraft } from './CreateMarketplacePost'
import { MarketplaceFeed } from './MarketplaceFeed'
import { MarketplaceInbox } from './MarketplaceInbox'

type MarketplaceWorkspaceTab = 'discover' | 'sell' | 'inbox'

function getThreadReadStorageKey(userId: string): string {
  return `rk-marketplace-thread-read:${userId}`
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function loadThreadReadMap(userId: string): Record<string, string> {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(getThreadReadStorageKey(userId))
    if (!raw) return {}

    const parsed = JSON.parse(raw) as Record<string, unknown>
    const next: Record<string, string> = {}
    for (const [threadId, seenAt] of Object.entries(parsed)) {
      if (typeof seenAt !== 'string') continue
      if (!seenAt.trim()) continue
      next[threadId] = seenAt
    }
    return next
  } catch {
    return {}
  }
}

function saveThreadReadMap(userId: string, map: Record<string, string>): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(getThreadReadStorageKey(userId), JSON.stringify(map))
  } catch {
    // Ignore persistence failures.
  }
}

function getWorkspaceNote(tab: MarketplaceWorkspaceTab): string {
  if (tab === 'discover') {
    return 'Browse active listings, compare bids, and message sellers when ready.'
  }
  if (tab === 'sell') {
    return 'Post your item and manage your own listings from one place.'
  }
  return 'Keep negotiations moving with private chat threads.'
}

export function MarketplaceHub() {
  const { user } = useAuthSession()
  const userId = user?.id ?? null
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<MarketplaceWorkspaceTab>('discover')
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [threadReadById, setThreadReadById] = useState<Record<string, string>>({})
  const [statusMessage, setStatusMessage] = useState('')
  const [statusTone, setStatusTone] = useState<'idle' | 'success' | 'error'>('idle')
  const [isCreating, setIsCreating] = useState(false)
  const [pendingStatusByPostId, setPendingStatusByPostId] = useState<Record<string, boolean>>({})
  const [pendingDeleteByPostId, setPendingDeleteByPostId] = useState<Record<string, boolean>>({})
  const [pendingReportByPostId, setPendingReportByPostId] = useState<Record<string, boolean>>({})
  const [isSendingMessage, setIsSendingMessage] = useState(false)

  const postsQuery = useQuery({
    queryKey: queryKeys.marketplace.posts(),
    queryFn: () => fetchMarketplacePosts(userId ?? undefined),
    enabled: Boolean(user),
  })
  const threadsQuery = useQuery({
    queryKey: queryKeys.marketplaceChats.threads(user?.id ?? 'anonymous'),
    queryFn: () => listMarketplaceChatThreads(user!.id, user!.isAdmin),
    enabled: Boolean(user),
  })
  const openReportsByViewerQuery = useQuery({
    queryKey: queryKeys.reports.byReporter(user?.id ?? 'anonymous'),
    queryFn: () => listOpenReportsByReporter(user!.id),
    enabled: Boolean(user && !user.isAdmin),
  })

  const posts = useMemo(() => postsQuery.data ?? [], [postsQuery.data])
  const threads = useMemo(() => threadsQuery.data ?? [], [threadsQuery.data])

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [selectedThreadId, threads],
  )

  const messagesQuery = useQuery({
    queryKey: selectedThreadId
      ? queryKeys.marketplaceChats.messages(selectedThreadId)
      : ['marketplace-chats', 'messages', 'none'],
    queryFn: () => listMarketplaceChatMessages(selectedThreadId!),
    enabled: Boolean(user && selectedThreadId),
  })

  const myListingsCount = useMemo(
    () => posts.filter((post) => post.seller_user_id === userId).length,
    [posts, userId],
  )
  const openListingsCount = useMemo(
    () => posts.filter((post) => post.status === 'active').length,
    [posts],
  )

  const markThreadAsSeen = useCallback((threadId: string, seenAt?: string | null): void => {
    const nextSeenAt = seenAt ?? new Date().toISOString()
    setThreadReadById((previous) => {
      const previousSeenAt = previous[threadId]
      if (toTimestamp(previousSeenAt) >= toTimestamp(nextSeenAt)) {
        return previous
      }
      return {
        ...previous,
        [threadId]: nextSeenAt,
      }
    })
  }, [])

  const threadHasNewActivityById = useMemo(() => {
    const next: Record<string, boolean> = {}

    for (const thread of threads) {
      if (!thread.last_message_at) {
        next[thread.id] = false
        continue
      }

      const latestMessageTimestamp = toTimestamp(thread.last_message_at)
      const seenTimestamp = toTimestamp(threadReadById[thread.id])
      next[thread.id] = latestMessageTimestamp > seenTimestamp
    }

    return next
  }, [threadReadById, threads])

  const newThreadCount = useMemo(
    () => threads.reduce((count, thread) => count + (threadHasNewActivityById[thread.id] ? 1 : 0), 0),
    [threadHasNewActivityById, threads],
  )

  const reportedMarketplacePostIds = useMemo(() => {
    const reportedPostIds = new Set<string>()

    for (const report of openReportsByViewerQuery.data ?? []) {
      if (report.target_type !== 'marketplace') continue
      if (!report.marketplace_post_id) continue
      reportedPostIds.add(report.marketplace_post_id)
    }

    return reportedPostIds
  }, [openReportsByViewerQuery.data])

  useEffect(() => {
    if (!userId) {
      setThreadReadById({})
      return
    }
    setThreadReadById(loadThreadReadMap(userId))
  }, [userId])

  useEffect(() => {
    if (!userId) return
    saveThreadReadMap(userId, threadReadById)
  }, [threadReadById, userId])

  useEffect(() => {
    if (!threads.length) {
      setSelectedThreadId(null)
      return
    }
    if (selectedThreadId && threads.some((thread) => thread.id === selectedThreadId)) return
    setSelectedThreadId(threads[0].id)
  }, [selectedThreadId, threads])

  useEffect(() => {
    if (!selectedThread?.last_message_at) return
    markThreadAsSeen(selectedThread.id, selectedThread.last_message_at)
  }, [markThreadAsSeen, selectedThread])

  const handleSelectThread = useCallback(
    (threadId: string): void => {
      setSelectedThreadId(threadId)
      const thread = threads.find((entry) => entry.id === threadId)
      if (thread?.last_message_at) {
        markThreadAsSeen(threadId, thread.last_message_at)
      }
    },
    [markThreadAsSeen, threads],
  )

  const handleMarkAllThreadsRead = useCallback((): void => {
    setThreadReadById((previous) => {
      let changed = false
      const next = { ...previous }

      for (const thread of threads) {
        const marker = thread.last_message_at ?? new Date().toISOString()
        if (toTimestamp(marker) <= toTimestamp(next[thread.id])) continue
        next[thread.id] = marker
        changed = true
      }

      return changed ? next : previous
    })
  }, [threads])

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
      setActiveTab('inbox')
      markThreadAsSeen(thread.id, thread.last_message_at)
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
      markThreadAsSeen(selectedThread.id)
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

  function promptReportReason(): string | null {
    const rawReason = window.prompt('Report reason (at least 5 characters)', '')
    if (rawReason === null) return null

    const normalizedReason = rawReason.trim().replace(/\s+/g, ' ').slice(0, 500)
    if (normalizedReason.length < 5) {
      setStatusTone('error')
      setStatusMessage('Please enter at least 5 characters for the report reason.')
      return null
    }

    return normalizedReason
  }

  async function handleReportPost(postId: string, isAlreadyReported: boolean): Promise<void> {
    if (!user || user.isAdmin) return

    let nextReason: string | null = null
    if (!isAlreadyReported) {
      nextReason = promptReportReason()
      if (!nextReason) return
    }

    setPendingReportByPostId((previous) => ({ ...previous, [postId]: true }))

    try {
      if (isAlreadyReported) {
        await clearOpenReportsByReporterTarget({
          target_type: 'marketplace',
          target_id: postId,
          reporter_user_id: user.id,
        })
        setStatusTone('success')
        setStatusMessage('Marketplace report removed.')
      } else {
        await createReport({
          target_type: 'marketplace',
          target_id: postId,
          reporter_user_id: user.id,
          reason: nextReason ?? 'No reason provided',
        })
        setStatusTone('success')
        setStatusMessage('Marketplace listing reported to admin.')
      }

      await invalidateAfterReportMutation(queryClient)
      await queryClient.invalidateQueries({ queryKey: queryKeys.reports.byReporter(user.id) })
    } catch (error) {
      setStatusTone('error')
      setStatusMessage(error instanceof Error ? error.message : 'Failed to update report.')
    } finally {
      setPendingReportByPostId((previous) => ({ ...previous, [postId]: false }))
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
    <div className="rk-marketplace-workspace">
      <section className="rk-marketplace-workspace-nav rk-card">
        <div className="rk-marketplace-workspace-tabs" role="tablist" aria-label="Marketplace workspace tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'discover'}
            className={`rk-marketplace-workspace-tab ${activeTab === 'discover' ? 'rk-marketplace-workspace-tab-active' : ''}`}
            onClick={() => setActiveTab('discover')}
          >
            <span>Discover</span>
            <small>{openListingsCount} open</small>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'sell'}
            className={`rk-marketplace-workspace-tab ${activeTab === 'sell' ? 'rk-marketplace-workspace-tab-active' : ''}`}
            onClick={() => setActiveTab('sell')}
          >
            <span>Sell</span>
            <small>{myListingsCount} mine</small>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'inbox'}
            className={`rk-marketplace-workspace-tab ${activeTab === 'inbox' ? 'rk-marketplace-workspace-tab-active' : ''}`}
            onClick={() => setActiveTab('inbox')}
          >
            <span>Inbox</span>
            <small>{newThreadCount > 0 ? `${newThreadCount} new` : `${threads.length} threads`}</small>
          </button>
        </div>
        <p className="rk-marketplace-workspace-note">{getWorkspaceNote(activeTab)}</p>
      </section>

      {activeTab === 'inbox' && statusMessage ? (
        <p className={statusTone === 'error' ? 'rk-auth-message rk-auth-error' : 'rk-auth-message rk-auth-success'}>
          {statusMessage}
        </p>
      ) : null}

      {postsQuery.isLoading ? <div className="rk-loading">Loading marketplace...</div> : null}
      {postsQuery.error instanceof Error ? (
        <p className="rk-auth-message rk-auth-error">{postsQuery.error.message}</p>
      ) : null}

      {!postsQuery.isLoading && !(postsQuery.error instanceof Error) && activeTab === 'discover' ? (
          <MarketplaceFeed
            posts={posts}
            currentUserId={user.id}
            currentUserLabel={user.label}
            isCreating={isCreating}
            statusMessage={statusMessage}
            statusTone={statusTone}
            pendingStatusByPostId={pendingStatusByPostId}
            pendingDeleteByPostId={pendingDeleteByPostId}
            pendingReportByPostId={pendingReportByPostId}
            reportedPostIds={reportedMarketplacePostIds}
            isCurrentUserAdmin={user.isAdmin}
            onCreatePost={handleCreatePost}
            onDeletePost={handleDeletePost}
            onUpdatePostStatus={handleUpdateStatus}
            onOpenChatWithSeller={handleOpenChatWithSeller}
            onOpenChatWithBidder={handleOpenChatWithBidder}
            onReportPost={handleReportPost}
            showCreateComposer={false}
            defaultMineOnly={false}
          />
        ) : null}

      {!postsQuery.isLoading && !(postsQuery.error instanceof Error) && activeTab === 'sell' ? (
          <MarketplaceFeed
            posts={posts}
            currentUserId={user.id}
            currentUserLabel={user.label}
            isCreating={isCreating}
            statusMessage={statusMessage}
            statusTone={statusTone}
            pendingStatusByPostId={pendingStatusByPostId}
            pendingDeleteByPostId={pendingDeleteByPostId}
            pendingReportByPostId={pendingReportByPostId}
            reportedPostIds={reportedMarketplacePostIds}
            isCurrentUserAdmin={user.isAdmin}
            onCreatePost={handleCreatePost}
            onDeletePost={handleDeletePost}
            onUpdatePostStatus={handleUpdateStatus}
            onOpenChatWithSeller={handleOpenChatWithSeller}
            onOpenChatWithBidder={handleOpenChatWithBidder}
            onReportPost={handleReportPost}
            showCreateComposer
            defaultMineOnly
          />
      ) : null}

      {activeTab === 'inbox' ? (
        <div className="rk-marketplace-inbox-layout">
          <MarketplaceInbox
            threads={threads}
            selectedThreadId={selectedThreadId}
            currentUserId={user.id}
            isAdmin={user.isAdmin}
            isLoading={threadsQuery.isLoading}
            threadHasNewActivityById={threadHasNewActivityById}
            newThreadCount={newThreadCount}
            onSelectThread={handleSelectThread}
            onMarkAllRead={handleMarkAllThreadsRead}
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
        </div>
      ) : null}
    </div>
  )
}
