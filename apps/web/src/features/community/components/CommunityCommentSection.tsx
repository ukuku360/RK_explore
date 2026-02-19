
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchComments, createComment, updateComment, deleteComment } from '../../../services/community/community.service'
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
  const [editContent, setEditContent] = useState('')
  const normalizedContent = content.trim()
  const normalizedEditContent = editContent.trim()
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
      queryClient.invalidateQueries({ queryKey: ['community_posts'] })
      setContent('')
      setIsSubmitting(false)
      setErrorMessage('')
    },
    onError: (error) => {
      setIsSubmitting(false)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to post comment.')
    }
  })

  const editCommentMutation = useMutation({
    mutationFn: async ({ commentId, text }: { commentId: string; text: string }) => updateComment(commentId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community_comments', postId] })
      queryClient.invalidateQueries({ queryKey: ['community_posts'] })
      setEditingCommentId(null)
      setEditContent('')
      setErrorMessage('')
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to edit comment.')
    },
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || isSubmitDisabled) return

    setIsSubmitting(true)
    addCommentMutation.mutate(normalizedContent)
  }

  function startEditing(comment: CommunityComment) {
    setEditingCommentId(comment.id)
    setEditContent(comment.content)
    setErrorMessage('')
  }

  function cancelEditing() {
    setEditingCommentId(null)
    setEditContent('')
  }

  async function handleEditSubmit(e: React.FormEvent, comment: CommunityComment) {
    e.preventDefault()
    if (normalizedEditContent.length === 0 || normalizedEditContent === comment.content) return

    await editCommentMutation.mutateAsync({ commentId: comment.id, text: normalizedEditContent })
  }

  function handleDelete(commentId: string) {
    if (confirm('Delete this comment?')) {
      deleteCommentMutation.mutate(commentId)
    }
  }

  if (isLoading) return <div className="rk-loading-small">Loading comments...</div>

  return (
    <div className="rk-comment-section">
      <div className="rk-comment-list">
        {comments.length === 0 ? (
          <p className="rk-feed-note">No replies yet. Start the conversation.</p>
        ) : (
          comments.map((comment) => {
            const isOwner = user?.id === comment.user_id
            const canDelete = isOwner
            const canEdit = isOwner
            const isEdited = comment.updated_at !== comment.created_at
            const isEditingCurrent = editingCommentId === comment.id

            return (
              <div key={comment.id} className="rk-comment-item">
                <div className="rk-comment-header">
                  <span className="rk-comment-author">{comment.author}</span>
                  <span className="rk-comment-time">
                    {formatDateTime(comment.created_at)}
                    {isEdited ? ` (Edited ${formatDateTime(comment.updated_at)})` : ''}
                  </span>
                </div>

                {isEditingCurrent ? (
                  <form onSubmit={(event) => void handleEditSubmit(event, comment)} className="rk-community-comment-edit-form">
                    <input
                      type="text"
                      className="rk-input rk-input-small"
                      value={editContent}
                      onChange={(event) => setEditContent(event.target.value)}
                      maxLength={COMMENT_MAX_LENGTH}
                      disabled={editCommentMutation.isPending}
                    />
                    <div className="rk-community-inline-actions">
                      <button
                        type="button"
                        className="rk-button-text rk-button-small"
                        onClick={cancelEditing}
                        disabled={editCommentMutation.isPending}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="rk-button rk-button-secondary rk-button-small"
                        disabled={
                          editCommentMutation.isPending ||
                          normalizedEditContent.length === 0 ||
                          normalizedEditContent === comment.content
                        }
                      >
                        {editCommentMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="rk-comment-content">{comment.content}</div>
                )}

                {(canEdit || canDelete) && !isEditingCurrent ? (
                  <div className="rk-community-inline-actions">
                    {canEdit ? (
                      <button
                        className="rk-button-text rk-button-tiny"
                        onClick={() => startEditing(comment)}
                      >
                        Edit
                      </button>
                    ) : null}
                    {canDelete ? (
                      <button
                        className="rk-button-text rk-button-danger rk-button-tiny"
                        onClick={() => handleDelete(comment.id)}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>

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
