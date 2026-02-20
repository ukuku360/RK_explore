import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CommunityPost } from '../../../types/domain'
import { COMMUNITY_POST_CATEGORY_META } from '../../../types/domain'
import { formatDateTime } from '../../../lib/formatters'
import { toggleLike } from '../../../services/community/community.service'
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
  onEdit: (id: string, content: string) => void | Promise<void>
  onDelete: (id: string) => void
  onAdminDelete: (post: CommunityPost) => void | Promise<void>
  onToggleReport: (id: string, isReported: boolean) => void | Promise<void>
  onShare: (id: string) => void | Promise<void>
  isShareCopied: boolean
  elementId: string
}

const COMMUNITY_POST_MAX_LENGTH = 280

export function CommunityPostCard({
  post,
  currentUserId,
  canReport,
  canAdminDelete,
  isReported,
  isReportPending,
  isAdminDeletePending,
  communityPostsQueryKey,
  onEdit,
  onDelete,
  onAdminDelete,
  onToggleReport,
  onShare,
  isShareCopied,
  elementId,
}: Props) {
  const isOwner = currentUserId === post.user_id
  const canDelete = isOwner
  const [showComments, setShowComments] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(post.content)
  const [isEditPending, setIsEditPending] = useState(false)
  const queryClient = useQueryClient()

  const normalizedEditContent = editContent.trim()
  const formattedUpdatedAt = formatDateTime(post.updated_at)
  const isEdited = post.updated_at !== post.created_at && formattedUpdatedAt !== '-'
  const isEditSubmitDisabled =
    isEditPending ||
    normalizedEditContent.length === 0 ||
    normalizedEditContent.length > COMMUNITY_POST_MAX_LENGTH ||
    normalizedEditContent === post.content

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

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isEditSubmitDisabled) return

    try {
      setIsEditPending(true)
      await onEdit(post.id, normalizedEditContent)
      setIsEditing(false)
    } finally {
      setIsEditPending(false)
    }
  }

  function handleEditCancel() {
    setEditContent(post.content)
    setIsEditing(false)
  }

  return (
    <div id={elementId} className="rk-card rk-community-card">
      <div className="rk-community-header">
        <div className="rk-community-header-left">
          <Link to={`/profile/${post.user_id}`} className="rk-community-author rk-author-link">{post.author}</Link>
          <span className="rk-community-category-badge">
            {COMMUNITY_POST_CATEGORY_META[post.category].emoji} {COMMUNITY_POST_CATEGORY_META[post.category].label}
          </span>
        </div>
        <div className="rk-community-header-meta">
          <span className="rk-community-time">{formatDateTime(post.created_at)}</span>
          {isEdited ? <span className="rk-community-time">(Edited {formattedUpdatedAt})</span> : null}
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
        <form onSubmit={handleEditSubmit} className="rk-community-edit-form">
          <textarea
            className="rk-input rk-textarea"
            rows={3}
            value={editContent}
            onChange={(event) => setEditContent(event.target.value)}
            maxLength={COMMUNITY_POST_MAX_LENGTH}
            disabled={isEditPending}
          />
          <div className="rk-community-compose-meta">
            <span className="rk-community-compose-help">{normalizedEditContent.length}/{COMMUNITY_POST_MAX_LENGTH}</span>
            <div className="rk-community-inline-actions">
              <button
                type="button"
                className="rk-button-text rk-button-small"
                onClick={handleEditCancel}
                disabled={isEditPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rk-button rk-button-secondary rk-button-small"
                disabled={isEditSubmitDisabled}
              >
                {isEditPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="rk-community-content">{post.content}</div>
      )}

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

        {canDelete && !isEditing && (
          <div className="rk-community-inline-actions">
            <button
              type="button"
              className="rk-button-text rk-button-small"
              onClick={() => {
                setEditContent(post.content)
                setIsEditing(true)
              }}
            >
              Edit
            </button>
            <button
              type="button"
              className="rk-button-text rk-button-danger rk-button-small"
              onClick={() => onDelete(post.id)}
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {showComments && <CommunityCommentSection postId={post.id} />}
    </div>
  )
}
