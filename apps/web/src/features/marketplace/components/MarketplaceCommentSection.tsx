import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuthSession } from '../../../app/providers/auth-session-context'
import { formatDateTime } from '../../../lib/formatters'
import { queryKeys } from '../../../lib/queryKeys'
import {
  createMarketplaceComment,
  deleteMarketplaceComment,
  fetchMarketplaceComments,
  updateMarketplaceComment,
} from '../../../services/marketplace/marketplace.service'
import type { MarketplaceComment } from '../../../types/domain'

type MarketplaceCommentSectionProps = {
  postId: string
}

export function MarketplaceCommentSection({ postId }: MarketplaceCommentSectionProps) {
  const { user } = useAuthSession()
  const queryClient = useQueryClient()

  const [draft, setDraft] = useState('')
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingDraftByCommentId, setEditingDraftByCommentId] = useState<Record<string, string>>({})
  const [errorMessage, setErrorMessage] = useState('')

  const commentsQuery = useQuery({
    queryKey: queryKeys.marketplaceComments.byPost(postId),
    queryFn: () => fetchMarketplaceComments(postId),
  })

  const createMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error('Please log in first.')
      return createMarketplaceComment(postId, content, user.label, user.id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceComments.byPost(postId) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.posts() })
      setDraft('')
      setErrorMessage('')
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to post comment.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      if (!user) throw new Error('Please log in first.')
      await deleteMarketplaceComment(commentId, user.id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceComments.byPost(postId) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.posts() })
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete comment.')
    },
  })

  const editMutation = useMutation({
    mutationFn: async (params: { commentId: string; content: string }) => {
      if (!user) throw new Error('Please log in first.')
      await updateMarketplaceComment(params.commentId, user.id, params.content)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceComments.byPost(postId) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.posts() })
      setEditingCommentId(null)
      setErrorMessage('')
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save comment edit.')
    },
  })

  function handleStartEdit(comment: MarketplaceComment) {
    setEditingCommentId(comment.id)
    setEditingDraftByCommentId((previous) => ({ ...previous, [comment.id]: comment.content }))
  }

  function handleCancelEdit(commentId: string) {
    setEditingCommentId((previous) => (previous === commentId ? null : previous))
    setEditingDraftByCommentId((previous) => {
      const next = { ...previous }
      delete next[commentId]
      return next
    })
  }

  function handleSaveEdit(commentId: string) {
    const nextContent = (editingDraftByCommentId[commentId] ?? '').trim()
    if (nextContent.length < 1) {
      setErrorMessage('Comment cannot be empty.')
      return
    }
    editMutation.mutate({ commentId, content: nextContent })
  }

  const comments = commentsQuery.data ?? []
  const trimmedDraft = draft.trim()

  return (
    <div className="rk-marketplace-comments">
      <div className="rk-comment-list">
        {commentsQuery.isLoading ? <p className="rk-feed-note">Loading comments...</p> : null}
        {commentsQuery.error instanceof Error ? (
          <p className="rk-auth-message rk-auth-error">{commentsQuery.error.message}</p>
        ) : null}
        {!commentsQuery.isLoading && comments.length === 0 ? (
          <p className="rk-feed-note">No comments yet.</p>
        ) : null}
        {comments.map((comment) => {
          const isOwner = user?.id === comment.user_id
          const isEditing = editingCommentId === comment.id
          const editingDraft = editingDraftByCommentId[comment.id] ?? comment.content

          return (
            <article key={comment.id} className="rk-comment-item">
              <div className="rk-comment-header">
                <span className="rk-comment-author">{comment.author}</span>
                <span className="rk-comment-time">{formatDateTime(comment.created_at)}</span>
              </div>
              {isEditing ? (
                <div className="rk-comment-form">
                  <input
                    className="rk-input rk-input-small"
                    value={editingDraft}
                    onChange={(event) =>
                      setEditingDraftByCommentId((previous) => ({
                        ...previous,
                        [comment.id]: event.target.value,
                      }))
                    }
                    disabled={editMutation.isPending}
                  />
                  <button
                    type="button"
                    className="rk-button rk-button-secondary rk-button-small"
                    onClick={() => handleSaveEdit(comment.id)}
                    disabled={editMutation.isPending}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="rk-button rk-button-small"
                    onClick={() => handleCancelEdit(comment.id)}
                    disabled={editMutation.isPending}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <p className="rk-comment-content">{comment.content}</p>
              )}
              {isOwner ? (
                <div className="rk-comment-meta-actions">
                  {!isEditing ? (
                    <button
                      type="button"
                      className="rk-button-text rk-button-small"
                      onClick={() => handleStartEdit(comment)}
                      disabled={editMutation.isPending}
                    >
                      Edit
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rk-button-text rk-button-danger rk-button-small"
                    onClick={() => deleteMutation.mutate(comment.id)}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
      <form
        className="rk-comment-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!trimmedDraft) return
          createMutation.mutate(trimmedDraft)
        }}
      >
        <input
          className="rk-input rk-input-small"
          placeholder="Write a public comment..."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={createMutation.isPending}
        />
        <button
          type="submit"
          className="rk-button rk-button-secondary rk-button-small"
          disabled={createMutation.isPending || trimmedDraft.length === 0}
        >
          Comment
        </button>
      </form>
      {errorMessage ? <p className="rk-auth-message rk-auth-error">{errorMessage}</p> : null}
    </div>
  )
}
