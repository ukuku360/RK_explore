import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import type { CommunityPost } from '../../../types/domain'

import { fetchCommunityPosts, createCommunityPost, deleteCommunityPost } from '../../../services/community/community.service'
import { useAuthSession } from '../../../app/providers/auth-session-context'
import { supabaseClient as supabase } from '../../../services/supabase/client'
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
  const communityPostsQueryKey: ['community_posts', string | undefined] = ['community_posts', user?.id]
  const sharedPostId = useMemo(() => getSharedPostIdFromSearch(location.search), [location.search])

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
    try {
      await createCommunityPost(content, user.label, user.id)
      // Optimistic update or wait for realtime/invalidation is handled by query
    } catch (error) {
      console.error('Failed to post', error)
      alert('Failed to post. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

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
              communityPostsQueryKey={communityPostsQueryKey}
              onDelete={handleDelete}
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
