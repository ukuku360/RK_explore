import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CommunityPost } from '../../../types/domain'
import { formatDateTime } from '../../../lib/formatters'
import { toggleLike, updateCommunityPost } from '../../../services/community/community.service'
import { CommunityCommentSection } from './CommunityCommentSection'

type Props = {
  post: CommunityPost
  currentUserId?: string
  canReport: boolean
  canAdminDelete: boolean
  isReported: boolean
  isReportPending: boolean
  isAdminDeletePending: boolean
  communityPostsQueryKey: readonly ['community_posts']
  onDelete: (id: string) => void
  onAdminDelete: (post: CommunityPost) => void | Promise<void>
  onToggleReport: (id: string, isReported: boolean) => void | Promise<void>
  onShare: (id: string) => void | Promise<void>
  isShareCopied: boolean
  elementId: string
}

export function CommunityPostCard({
  post,
  currentUserId,
  canReport,
  canAdminDelete,
  isReported,
  isReportPending,
  isAdminDeletePending,
  communityPostsQueryKey,
  onDelete,
  onAdminDelete,
  onToggleReport,
  onShare,
  isShareCopied,
  elementId,
}: Props) {
  const isOwner = currentUserId === post.user_id
  const canDelete = isOwner
  const canEdit = isOwner
  const [showComments, setShowComments] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(post.content)
  const queryClient = useQueryClient()
  const trimmedEditContent = editContent.trim()

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error('Please log in first.')
      if (!canEdit) throw new Error('Only the post owner can edit this post.')
      if (!trimmedEditContent) throw new Error('Post content cannot be empty.')
      if (trimmedEditContent.length > 280) throw new Error('Post content must be 280 characters or less.')
      return updateCommunityPost(post.id, currentUserId, trimmedEditContent)
    },
    onSuccess: async () => {
      setIsEditing(false)
      await queryClient.invalidateQueries({ queryKey: ['community_posts'] })
    },
    onError: (error) => {
      alert(error instanceof Error ? error.message : 'Failed to save post edit.')
    },
  })

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserId) return
      return toggleLike(post.id, currentUserId)
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: communityPostsQueryKey })
      const previousPosts = queryClient.getQueryData(communityPostsQueryKey)

      queryClient.setQueryData(communityPostsQueryKey, (old: CommunityPost[] | undefined) => {
        if (!old) return []
        return old.map((p) => {
          if (p.id === post.id) {
            return {
              ...p,
              likes_count: p.has_liked ? p.likes_count - 1 : p.likes_count + 1,
              has_liked: !p.has_liked,
            }
          }
          return p
        })
      })

      return { previousPosts }
    },
    onError: (_err, _newTodo, context) => {
      queryClient.setQueryData(communityPostsQueryKey, context?.previousPosts)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['community_posts'] })
    },
  })

  function handleLike() {
    if (!currentUserId) {
      alert('Please log in to like posts')
      return
    }
    likeMutation.mutate()
  }

  function handleStartEdit() {
    setEditContent(post.content)
    setIsEditing(true)
  }

  function handleCancelEdit() {
    setEditContent(post.content)
    setIsEditing(false)
  }

  function handleSaveEdit() {
    editMutation.mutate()
  }

  return (
    <div id={elementId} className="rk-card rk-community-card">
      <div className="rk-community-header">
        <Link to={`/profile/${post.user_id}`} className="rk-community-author rk-author-link">{post.author}</Link>
        <div className="rk-community-header-meta">
          <span className="rk-community-time">{formatDateTime(post.created_at)}</span>
          {canAdminDelete ? (
            <button
              type="button"
              className="rk-admin-quick-delete"
              onClick={() => void onAdminDelete(post)}
              disabled={isAdminDeletePending}
            >
              {isAdminDeletePending ? 'Deleting...' : 'Delete'}
            </button>
          ) : null}
        </div>
      </div>

      {isEditing ? (
        <div className="rk-community-form">
          <textarea
            className="rk-input rk-textarea"
            rows={3}
            value={editContent}
            onChange={(event) => setEditContent(event.target.value)}
            maxLength={280}
            disabled={editMutation.isPending}
          />
          <div className="rk-community-compose-meta">
            <span className="rk-community-compose-help">{trimmedEditContent.length}/280</span>
            <div className="rk-form-actions">
              <button
                type="button"
                className="rk-button rk-button-primary rk-button-small"
                onClick={handleSaveEdit}
                disabled={editMutation.isPending || trimmedEditContent.length === 0}
              >
                {editMutation.isPending ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                className="rk-button rk-button-secondary rk-button-small"
                onClick={handleCancelEdit}
                disabled={editMutation.isPending}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rk-community-content">{post.content}</div>
      )}

      {/* Engagement Actions */}
      <div className="rk-community-footer">
        <div className="rk-engagement-actions">
          <button
            type="button"
            className={`rk-action-btn ${post.has_liked ? 'liked' : ''}`}
            onClick={handleLike}
            aria-pressed={post.has_liked}
            aria-label={post.has_liked ? `Unlike (${post.likes_count})` : `Like (${post.likes_count})`}
          >
            {post.has_liked ? '❤️' : '🤍'}
            <span>{post.likes_count}</span>
          </button>

          <button
            type="button"
            className="rk-action-btn"
            onClick={() => setShowComments(!showComments)}
            aria-expanded={showComments}
            aria-label={showComments ? `Hide comments (${post.comments_count})` : `Show comments (${post.comments_count})`}
          >
            💬 <span>{post.comments_count}</span>
          </button>

          <button
            type="button"
            className={`rk-action-btn ${isShareCopied ? 'liked' : ''}`}
            onClick={() => void onShare(post.id)}
            aria-label={isShareCopied ? 'Community link copied' : 'Share this community post'}
          >
            🔗 <span>{isShareCopied ? 'Copied URL' : 'Share'}</span>
          </button>

          {canReport ? (
            <button
              type="button"
              className={`rk-action-btn ${isReported ? 'rk-action-btn-alert' : ''}`}
              onClick={() => void onToggleReport(post.id, isReported)}
              disabled={isReportPending}
              aria-pressed={isReported}
            >
              🚩 <span>{isReported ? 'Reported' : 'Report'}</span>
            </button>
          ) : null}
        </div>

        {canDelete && (
          <button
            type="button"
            className="rk-button-text rk-button-danger rk-button-small"
            onClick={() => onDelete(post.id)}
            disabled={editMutation.isPending}
          >
            Delete
          </button>
        )}
        {canEdit && !isEditing ? (
          <button
            type="button"
            className="rk-button-text rk-button-small"
            onClick={handleStartEdit}
            disabled={editMutation.isPending}
          >
            Edit
          </button>
        ) : null}
      </div>

      {showComments && <CommunityCommentSection postId={post.id} />}
    </div>
  )
}
