import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import type { CommunityPost } from '../../../types/domain'

import { createAdminLog } from '../../../services/admin/admin.service'
import {
  fetchCommunityPosts,
  createCommunityPost,
  updateCommunityPost,
  deleteCommunityPost,
} from '../../../services/community/community.service'
import { clearOpenReportsByReporterTarget, createReport, reviewReportsByTarget } from '../../../services/reports/reports.service'
import { useAuthSession } from '../../../app/providers/auth-session-context'
import { invalidateAfterAdminLogMutation, invalidateAfterReportMutation } from '../../../lib/queryInvalidation'
import { supabaseClient as supabase } from '../../../services/supabase/client'
import { useMyOpenReportsQuery } from '../../reports/hooks/useMyOpenReportsQuery'
import {
  COMMUNITY_FEED_TABS,
  COMMUNITY_SORT_OPTIONS,
  filterCommunityPosts,
  getCommunityOverview,
  sortCommunityPosts,
  type CommunityFeedTab,
  type CommunitySortOption,
} from '../lib/discovery'
import { CommunityPostCard } from './CommunityPostCard'
import { CreateCommunityPost } from './CreateCommunityPost'

const SHARED_POST_QUERY_PARAM = 'post'
const SHARED_POST_HIGHLIGHT_MS = 2200
const SHARE_COPY_FEEDBACK_MS = 1600

const COMMUNITY_TAB_LABEL: Record<CommunityFeedTab, string> = {
  all: 'All',
  my_posts: 'My Posts',
  needs_reply: 'Needs Reply',
}

const COMMUNITY_SORT_LABEL: Record<CommunitySortOption, string> = {
  newest: 'Newest',
  popular: 'Popular',
}

function getSharedCommunityPostElementId(postId: string): string {
  return `rk-community-post-${postId}`
}

function getSharedPostIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search)
  const sharedPostId = params.get(SHARED_POST_QUERY_PARAM)?.trim() ?? ''
  return sharedPostId.length > 0 ? sharedPostId : null
}

function buildSharePostUrl(origin: string, pathname: string, postId: string): string {
  const shareUrl = new URL(pathname || '/community', origin)
  shareUrl.searchParams.set(SHARED_POST_QUERY_PARAM, postId)
  shareUrl.hash = ''
  return shareUrl.toString()
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false

  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Falls back to legacy copy path when Clipboard API is blocked.
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  document.body.appendChild(textarea)
  textarea.select()

  let copied = false
  try {
    copied = document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }

  return copied
}

function getCommunityEmptyState(params: { hasAnyPost: boolean; hasSearch: boolean; tab: CommunityFeedTab }): {
  title: string
  description: string
} {
  if (!params.hasAnyPost) {
    return {
      title: 'No community posts yet',
      description: 'Start with a quick update or question so neighbors can respond.',
    }
  }

  if (params.hasSearch) {
    return {
      title: 'No results for this search',
      description: 'Try a simpler keyword or reset filters.',
    }
  }

  if (params.tab === 'my_posts') {
    return {
      title: 'No posts from you yet',
      description: 'Share your first update to start your thread history.',
    }
  }

  return {
    title: 'No posts need replies right now',
    description: 'Switch to All posts or check back later.',
  }
}

export function CommunityFeed() {
  const { user } = useAuthSession()
  const location = useLocation()
  const queryClient = useQueryClient()
  const preparedSharedPostViewRef = useRef<string | null>(null)
  const focusedSharedPostRef = useRef<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null)
  const [feedTab, setFeedTab] = useState<CommunityFeedTab>('all')
  const [sortOption, setSortOption] = useState<CommunitySortOption>('newest')
  const [searchText, setSearchText] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [statusTone, setStatusTone] = useState<'idle' | 'error' | 'success'>('idle')
  const [isReportPendingByPostId, setIsReportPendingByPostId] = useState<Record<string, boolean>>({})
  const [isAdminDeletePendingByPostId, setIsAdminDeletePendingByPostId] = useState<Record<string, boolean>>({})
  // Use stable query key without user.id to prevent cache invalidation on auth state change
  const communityPostsQueryKey = ['community_posts'] as const
  const sharedPostId = useMemo(() => getSharedPostIdFromSearch(location.search), [location.search])
  const myOpenReportsQuery = useMyOpenReportsQuery(user?.id, Boolean(user && !user.isAdmin))

  const { data: posts = [], isLoading } = useQuery<CommunityPost[]>({
    queryKey: communityPostsQueryKey,
    queryFn: () => fetchCommunityPosts(user?.id),
  })

  const overview = useMemo(() => getCommunityOverview(posts, user?.id), [posts, user?.id])
  const filteredPosts = useMemo(
    () =>
      filterCommunityPosts(posts, {
        tab: feedTab,
        currentUserId: user?.id,
        searchText,
      }),
    [feedTab, posts, searchText, user?.id],
  )
  const visiblePosts = useMemo(() => sortCommunityPosts(filteredPosts, sortOption), [filteredPosts, sortOption])
  const myReportedCommunityPostIds = useMemo(() => {
    const reportedPostIds = new Set<string>()

    for (const report of myOpenReportsQuery.data ?? []) {
      if (report.status !== 'open') continue
      if (report.target_type !== 'community') continue
      if (!report.community_post_id) continue
      reportedPostIds.add(report.community_post_id)
    }

    return reportedPostIds
  }, [myOpenReportsQuery.data])
  const hasActiveDiscovery = searchText.trim().length > 0 || feedTab !== 'all' || sortOption !== 'newest'
  const emptyState = getCommunityEmptyState({
    hasAnyPost: posts.length > 0,
    hasSearch: searchText.trim().length > 0,
    tab: feedTab,
  })

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('community-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_posts' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['community_posts'] })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_likes' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['community_posts'] })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_comments' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['community_posts'] })
          queryClient.invalidateQueries({ queryKey: ['community_comments'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  useEffect(() => {
    if (!copiedPostId) return

    const timeoutId = window.setTimeout(() => {
      setCopiedPostId((previous) => (previous === copiedPostId ? null : previous))
    }, SHARE_COPY_FEEDBACK_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [copiedPostId])

  useEffect(() => {
    if (!sharedPostId) return
    if (preparedSharedPostViewRef.current === sharedPostId) return

    preparedSharedPostViewRef.current = sharedPostId
    setFeedTab('all')
    setSortOption('newest')
    setSearchText('')
  }, [sharedPostId])

  useEffect(() => {
    if (!sharedPostId) return
    if (focusedSharedPostRef.current === sharedPostId) return
    if (isLoading) return

    const matchedPost = posts.find((post) => post.id === sharedPostId)
    if (!matchedPost) {
      focusedSharedPostRef.current = sharedPostId
      setStatusTone('error')
      setStatusMessage('The shared post was not found in community.')
      return
    }

    const isVisible = visiblePosts.some((post) => post.id === sharedPostId)
    if (!isVisible) return

    const target = document.getElementById(getSharedCommunityPostElementId(sharedPostId))
    if (!target) return

    focusedSharedPostRef.current = sharedPostId
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    target.classList.add('rk-community-card-shared-target')
    setStatusTone('success')
    setStatusMessage('Opened shared community post.')

    const timeoutId = window.setTimeout(() => {
      target.classList.remove('rk-community-card-shared-target')
    }, SHARED_POST_HIGHLIGHT_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [isLoading, posts, sharedPostId, visiblePosts])

  async function handleCreate(content: string) {
    if (!user) return
    setIsSubmitting(true)
    setStatusTone('idle')
    setStatusMessage('')
    try {
      const createdPost = await createCommunityPost(content, user.label, user.id)

      setFeedTab('all')
      setSortOption('newest')
      setSearchText('')

      queryClient.setQueryData<CommunityPost[]>(communityPostsQueryKey, (previous) => {
        const currentPosts = previous ?? []
        const dedupedPosts = currentPosts.filter((post) => post.id !== createdPost.id)
        return [createdPost, ...dedupedPosts]
      })

      await queryClient.invalidateQueries({ queryKey: ['community_posts'] })
      setStatusTone('success')
      setStatusMessage('Posted to community.')
    } catch (error) {
      console.error('Failed to post', error)
      setStatusTone('error')
      setStatusMessage(error instanceof Error ? error.message : 'Failed to post. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }



  const editMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => updateCommunityPost(postId, content),
    onSuccess: async (updatedPost) => {
      queryClient.setQueryData<CommunityPost[]>(communityPostsQueryKey, (previous) => {
        if (!previous) return []
        return previous.map((post) => {
          if (post.id !== updatedPost.id) return post

          return {
            ...post,
            content: updatedPost.content,
            updated_at: updatedPost.updated_at,
          }
        })
      })

      await queryClient.invalidateQueries({ queryKey: ['community_posts'] })
      setStatusTone('success')
      setStatusMessage('Post updated.')
    },
    onError: (error) => {
      console.error('Failed to edit post', error)
      setStatusTone('error')
      setStatusMessage(error instanceof Error ? error.message : 'Failed to update post.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCommunityPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community_posts'] })
    },
    onError: (error) => {
      console.error('Failed to delete', error)
      alert('Failed to delete post.')
    }
  })



  async function handleEdit(postId: string, content: string) {
    await editMutation.mutateAsync({ postId, content })
  }

  function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this post?')) return
    deleteMutation.mutate(id)
  }

  function resetDiscovery() {
    setFeedTab('all')
    setSortOption('newest')
    setSearchText('')
  }

  async function handleShare(postId: string) {
    if (typeof window === 'undefined') return

    const shareUrl = buildSharePostUrl(window.location.origin, location.pathname, postId)
    const copied = await copyTextToClipboard(shareUrl)
    if (!copied) {
      setStatusTone('error')
      setStatusMessage('Unable to copy community post URL. Please try again.')
      return
    }

    setCopiedPostId(postId)
    setStatusTone('success')
    setStatusMessage('Community post URL copied. Share it in SNS.')
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

  async function handleReportToggle(postId: string, isAlreadyReported: boolean) {
    if (!user || user.isAdmin) return

    let nextReason: string | null = null
    if (!isAlreadyReported) {
      nextReason = promptReportReason()
      if (!nextReason) return
    }

    setIsReportPendingByPostId((previous) => ({ ...previous, [postId]: true }))

    try {
      if (isAlreadyReported) {
        await clearOpenReportsByReporterTarget({
          target_type: 'community',
          target_id: postId,
          reporter_user_id: user.id,
        })
        setStatusTone('success')
        setStatusMessage('Report removed.')
      } else {
        await createReport({
          target_type: 'community',
          target_id: postId,
          reporter_user_id: user.id,
          reporter_email: user.email,
          reporter_nickname: user.label,
          reason: nextReason ?? 'No reason provided',
        })
        setStatusTone('success')
        setStatusMessage('Community post reported to admin.')
      }

      await invalidateAfterReportMutation(queryClient)
    } catch (error) {
      setStatusTone('error')
      setStatusMessage(error instanceof Error ? error.message : 'Failed to update report.')
    } finally {
      setIsReportPendingByPostId((previous) => ({ ...previous, [postId]: false }))
    }
  }

  async function handleAdminQuickDelete(post: CommunityPost) {
    if (!user || !user.isAdmin) return

    const summary = post.content.trim().replace(/\s+/g, ' ').slice(0, 40)
    const fallbackSummary = summary.length > 0 ? summary : post.id
    if (!window.confirm('Delete this community post right away? This cannot be undone.')) return

    setIsAdminDeletePendingByPostId((previous) => ({ ...previous, [post.id]: true }))

    try {
      await deleteCommunityPost(post.id)

      await reviewReportsByTarget({
        target_type: 'community',
        target_id: post.id,
        status: 'actioned',
        reviewed_by_user_id: user.id,
      })

      await createAdminLog({
        post_id: null,
        report_id: null,
        action: 'delete',
        reason: `Quick delete from community card (${fallbackSummary})`,
        admin_user_id: user.id,
        admin_email: user.email,
      })

      await queryClient.invalidateQueries({ queryKey: ['community_posts'] })
      await invalidateAfterAdminLogMutation(queryClient)
      setStatusTone('success')
      setStatusMessage('Community post deleted.')
    } catch (error) {
      setStatusTone('error')
      setStatusMessage(error instanceof Error ? error.message : 'Failed to delete community post.')
    } finally {
      setIsAdminDeletePendingByPostId((previous) => ({ ...previous, [post.id]: false }))
    }
  }

  if (isLoading) {
    return <div className="rk-loading">Loading community posts...</div>
  }

  return (
    <div className="rk-feed-container">
      <CreateCommunityPost onSubmit={handleCreate} isSubmitting={isSubmitting} />

      {statusMessage ? (
        <p className={statusTone === 'error' ? 'rk-auth-message rk-auth-error' : 'rk-auth-message rk-auth-success'}>
          {statusMessage}
        </p>
      ) : null}

      <section className="rk-filter-toolbar rk-community-discovery">
        <div className="rk-community-overview">
          <div className="rk-community-metric">
            <strong>{overview.totalPosts}</strong>
            <span>Posts</span>
          </div>
          <div className="rk-community-metric">
            <strong>{overview.needsReply}</strong>
            <span>Needs Reply</span>
          </div>
          <div className="rk-community-metric">
            <strong>{overview.totalEngagements}</strong>
            <span>Engagements</span>
          </div>
          <div className="rk-community-metric">
            <strong>{overview.myPosts}</strong>
            <span>My Posts</span>
          </div>
        </div>

        <div className="rk-discovery rk-community-search">
          <input
            className="rk-post-input"
            placeholder="Search by keyword or author..."
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
        </div>

        <div className="rk-feed-tabs" role="tablist" aria-label="Community feed tabs">
          {COMMUNITY_FEED_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={feedTab === tab}
              className={`rk-chip rk-feed-tab ${feedTab === tab ? 'rk-chip-active' : ''}`}
              onClick={() => setFeedTab(tab)}
            >
              {COMMUNITY_TAB_LABEL[tab]}
            </button>
          ))}
        </div>

        <div className="rk-community-sort-row">
          <span className="rk-community-sort-label">Sort</span>
          <div className="rk-discovery-chips">
            {COMMUNITY_SORT_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={`rk-chip ${sortOption === option ? 'rk-chip-active' : ''}`}
                onClick={() => setSortOption(option)}
              >
                {COMMUNITY_SORT_LABEL[option]}
              </button>
            ))}
            {hasActiveDiscovery ? (
              <button type="button" className="rk-chip" onClick={resetDiscovery}>
                Reset
              </button>
            ) : null}
          </div>
        </div>
        <p className="rk-feed-note">Showing {visiblePosts.length} posts</p>
      </section>
      
      <div className="rk-community-list">
        {visiblePosts.length === 0 ? (
          <div className="rk-empty-state">
            <strong>{emptyState.title}</strong>
            <p>{emptyState.description}</p>
          </div>
        ) : (
          visiblePosts.map((post) => (
            <CommunityPostCard
              key={post.id}
              post={post}
              currentUserId={user?.id}
              canReport={Boolean(user && !user.isAdmin)}
              canAdminDelete={Boolean(user?.isAdmin)}
              isReported={myReportedCommunityPostIds.has(post.id)}
              isReportPending={Boolean(isReportPendingByPostId[post.id])}
              isAdminDeletePending={Boolean(isAdminDeletePendingByPostId[post.id])}
              communityPostsQueryKey={communityPostsQueryKey}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAdminDelete={handleAdminQuickDelete}
              onToggleReport={handleReportToggle}
              onShare={handleShare}
              isShareCopied={copiedPostId === post.id}
              elementId={getSharedCommunityPostElementId(post.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
