
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import type { CommunityPost } from '../../../types/domain'

import { fetchCommunityPosts, createCommunityPost, deleteCommunityPost } from '../../../services/community/community.service'
import { useAuthSession } from '../../../app/providers/auth-session-context'
import { supabaseClient as supabase } from '../../../services/supabase/client'
import { CommunityPostCard } from './CommunityPostCard'
import { CreateCommunityPost } from './CreateCommunityPost'

const SHARED_POST_QUERY_PARAM = 'post'
const SHARED_POST_HIGHLIGHT_MS = 2200
const SHARE_COPY_FEEDBACK_MS = 1600

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

export function CommunityFeed() {
  const { user } = useAuthSession()
  const location = useLocation()
  const queryClient = useQueryClient()
  const focusedSharedPostRef = useRef<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusTone, setStatusTone] = useState<'idle' | 'error' | 'success'>('idle')
  const communityPostsQueryKey: ['community_posts', string | undefined] = ['community_posts', user?.id]
  const sharedPostId = useMemo(() => getSharedPostIdFromSearch(location.search), [location.search])


  const { data: posts = [], isLoading } = useQuery<CommunityPost[]>({
    queryKey: communityPostsQueryKey,
    queryFn: () => fetchCommunityPosts(user?.id),
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
    if (focusedSharedPostRef.current === sharedPostId) return
    if (isLoading) return

    const matchedPost = posts.find((post) => post.id === sharedPostId)
    if (!matchedPost) {
      focusedSharedPostRef.current = sharedPostId
      setStatusTone('error')
      setStatusMessage('The shared post was not found in community.')
      return
    }

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
  }, [isLoading, posts, sharedPostId])

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
      
      <div className="rk-community-list">
        {posts.length === 0 ? (
          <div className="rk-empty-state">
            No community posts yet. Be the first!
          </div>
        ) : (
          posts.map((post) => (
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
