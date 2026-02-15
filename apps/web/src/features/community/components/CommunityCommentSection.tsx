
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchComments, createComment, deleteComment } from '../../../services/community/community.service'
import { useAuthSession } from '../../../app/providers/auth-session-context'
import { formatDateTime } from '../../../lib/formatters'

type Props = {
  postId: string
}

export function CommunityCommentSection({ postId }: Props) {
  const { user, isAdmin } = useAuthSession()
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: comments = [], isLoading } = useQuery({
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
    },
    onError: () => {
      setIsSubmitting(false)
      alert('Failed to post comment')
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
    if (!content.trim() || !user) return

    setIsSubmitting(true)
    addCommentMutation.mutate(content)
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
        {comments.map((comment) => {
          const isOwner = user?.id === comment.user_id
          const canDelete = isOwner || isAdmin

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
        })}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="rk-comment-form">
        <input
          type="text"
          className="rk-input rk-input-small"
          placeholder="Write a comment..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={isSubmitting}
        />
        <button
          type="submit"
          className="rk-button rk-button-secondary rk-button-small"
          disabled={isSubmitting || !content.trim()}
        >
          Reply
        </button>
      </form>
    </div>
  )
}
