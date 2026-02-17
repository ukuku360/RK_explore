
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchComments, createComment, deleteComment } from '../../../services/community/community.service'
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

            return (
              <div key={comment.id} className="rk-comment-item">
                <div className="rk-comment-header">
                  <span className="rk-comment-author">{comment.author}</span>
                  <span className="rk-comment-time">{formatDateTime(comment.created_at)}</span>
                </div>
                <div className="rk-comment-content">{comment.content}</div>
                {canDelete && (
                  <button
                    className="rk-button-text rk-button-danger rk-button-tiny"
                    onClick={() => handleDelete(comment.id)}
                  >
                    Delete
                  </button>
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
