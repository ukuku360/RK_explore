
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchComments,
  createComment,
  deleteComment,
  updateCommunityComment,
} from '../../../services/community/community.service'
import { useAuthSession } from '../../../app/providers/auth-session-context'
import { formatDateTime } from '../../../lib/formatters'
import type { CommunityComment } from '../../../types/domain'

type Props = {
  postId: string
}

const COMMENT_MAX_LENGTH = 220

export function CommunityCommentSection({ postId }: Props) {
  const { user } = useAuthSession()
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editDraftByCommentId, setEditDraftByCommentId] = useState<Record<string, string>>({})
  const normalizedContent = content.trim()
  const isSubmitDisabled = isSubmitting || normalizedContent.length === 0

  const { data: comments = [], isLoading } = useQuery<CommunityComment[]>({
    queryKey: ['community_comments', postId],
    queryFn: () => fetchComments(postId),
  })

  const addCommentMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!user) throw new Error('Not authenticated')
      return createComment(postId, text, user.label, user.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community_comments', postId] })
      queryClient.invalidateQueries({ queryKey: ['community_posts'] }) // Update comment count on post
      setContent('')
      setIsSubmitting(false)
      setErrorMessage('')
    },
    onError: (error) => {
      setIsSubmitting(false)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to post comment.')
    }
  })

  const deleteCommentMutation = useMutation({
    mutationFn: deleteComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community_comments', postId] })
      queryClient.invalidateQueries({ queryKey: ['community_posts'] })
    },
    onError: () => {
      alert('Failed to delete comment')
    }
  })

  const editCommentMutation = useMutation({
    mutationFn: async (params: { commentId: string; nextContent: string }) => {
      if (!user) throw new Error('Not authenticated')
      return updateCommunityComment(params.commentId, user.id, params.nextContent)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community_comments', postId] })
      queryClient.invalidateQueries({ queryKey: ['community_posts'] })
      setEditingCommentId(null)
      setErrorMessage('')
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save comment edit.')
    },
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || isSubmitDisabled) return

    setIsSubmitting(true)
    addCommentMutation.mutate(normalizedContent)
  }

  function handleDelete(commentId: string) {
    if (confirm('Delete this comment?')) {
      deleteCommentMutation.mutate(commentId)
    }
  }

  function handleStartEdit(comment: CommunityComment) {
    setEditingCommentId(comment.id)
    setEditDraftByCommentId((previous) => ({
      ...previous,
      [comment.id]: comment.content,
    }))
  }

  function handleCancelEdit(commentId: string) {
    setEditingCommentId((previous) => (previous === commentId ? null : previous))
    setEditDraftByCommentId((previous) => {
      const next = { ...previous }
      delete next[commentId]
      return next
    })
  }

  function handleSaveEdit(comment: CommunityComment) {
    if (!user) return

    const nextContent = (editDraftByCommentId[comment.id] ?? '').trim()
    if (!nextContent) {
      setErrorMessage('Comment content cannot be empty.')
      return
    }
    if (nextContent.length > COMMENT_MAX_LENGTH) {
      setErrorMessage(`Comment must be ${COMMENT_MAX_LENGTH} characters or less.`)
      return
    }
    if (nextContent === comment.content.trim()) {
      handleCancelEdit(comment.id)
      return
    }

    editCommentMutation.mutate({ commentId: comment.id, nextContent })
  }

  if (isLoading) return <div className="rk-loading-small">Loading comments...</div>

  return (
    <div className="rk-comment-section">
      {/* List */}
      <div className="rk-comment-list">
        {comments.length === 0 ? (
          <p className="rk-feed-note">No replies yet. Start the conversation.</p>
        ) : (
          comments.map((comment) => {
            const isOwner = user?.id === comment.user_id
            const canDelete = isOwner
            const canEdit = isOwner
            const isEditing = editingCommentId === comment.id
            const editDraft = editDraftByCommentId[comment.id] ?? comment.content

            return (
              <div key={comment.id} className="rk-comment-item">
                <div className="rk-comment-header">
                  <span className="rk-comment-author">{comment.author}</span>
                  <span className="rk-comment-time">{formatDateTime(comment.created_at)}</span>
                </div>
                {isEditing ? (
                  <div className="rk-comment-form rk-reply-form">
                    <input
                      type="text"
                      className="rk-input rk-input-small"
                      value={editDraft}
                      onChange={(event) =>
                        setEditDraftByCommentId((previous) => ({
                          ...previous,
                          [comment.id]: event.target.value,
                        }))
                      }
                      maxLength={COMMENT_MAX_LENGTH}
                      disabled={editCommentMutation.isPending}
                    />
                    <button
                      type="button"
                      className="rk-button rk-button-secondary rk-button-small"
                      onClick={() => handleSaveEdit(comment)}
                      disabled={editCommentMutation.isPending}
                    >
                      {editCommentMutation.isPending ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className="rk-button rk-button-small"
                      onClick={() => handleCancelEdit(comment.id)}
                      disabled={editCommentMutation.isPending}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="rk-comment-content">{comment.content}</div>
                )}
                {canDelete && (
                  <div className="rk-comment-meta-actions">
                    {canEdit && !isEditing ? (
                      <button
                        className="rk-button-text rk-button-tiny"
                        onClick={() => handleStartEdit(comment)}
                        disabled={editCommentMutation.isPending}
                      >
                        Edit
                      </button>
                    ) : null}
                    <button
                      className="rk-button-text rk-button-danger rk-button-tiny"
                      onClick={() => handleDelete(comment.id)}
                      disabled={editCommentMutation.isPending}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="rk-comment-form">
        <input
          type="text"
          className="rk-input rk-input-small"
          placeholder="Write a comment..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={COMMENT_MAX_LENGTH}
          disabled={isSubmitting}
        />
        <button
          type="submit"
          className="rk-button rk-button-secondary rk-button-small"
          disabled={isSubmitDisabled}
        >
          Reply
        </button>
      </form>
      <div className="rk-community-comment-meta">
        <span className="rk-community-comment-count">
          {normalizedContent.length}/{COMMENT_MAX_LENGTH}
        </span>
        {errorMessage ? <span className="rk-community-comment-error">{errorMessage}</span> : null}
      </div>
    </div>
  )
}
