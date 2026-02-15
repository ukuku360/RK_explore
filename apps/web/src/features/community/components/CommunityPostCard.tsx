
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CommunityPost } from '../../../types/domain'
import { formatDateTime } from '../../../lib/formatters' 
import { toggleLike } from '../../../services/community/community.service'
import { CommunityCommentSection } from './CommunityCommentSection'

type Props = {
  post: CommunityPost
  currentUserId?: string
  isAdmin: boolean
  onDelete: (id: string) => void
}

export function CommunityPostCard({ post, currentUserId, isAdmin, onDelete }: Props) {
  const isOwner = currentUserId === post.user_id
  const canDelete = isOwner || isAdmin
  const [showComments, setShowComments] = useState(false)
  const queryClient = useQueryClient()

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserId) return
      return toggleLike(post.id, currentUserId)
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['community_posts'] })
      const previousPosts = queryClient.getQueryData(['community_posts'])

      queryClient.setQueryData(['community_posts'], (old: CommunityPost[] | undefined) => {
        if (!old) return []
        return old.map(p => {
          if (p.id === post.id) {
            return {
              ...p,
              likes_count: p.has_liked ? p.likes_count - 1 : p.likes_count + 1,
              has_liked: !p.has_liked
            }
          }
          return p
        })
      })

      return { previousPosts }
    },
    onError: (_err, _newTodo, context) => {
      queryClient.setQueryData(['community_posts'], context?.previousPosts)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['community_posts'] })
    }
  })

  function handleLike() {
    if (!currentUserId) {
      alert('Please log in to like posts')
      return
    }
    likeMutation.mutate()
  }

  return (
    <div className="rk-card rk-community-card">
      <div className="rk-community-header">
        <span className="rk-community-author">{post.author}</span>
        <span className="rk-community-time">{formatDateTime(post.created_at)}</span>
      </div>
      
      <div className="rk-community-content">{post.content}</div>

      {/* Engagement Actions */}
      <div className="rk-community-footer">
        <div className="rk-engagement-actions">
          <button 
            className={`rk-action-btn ${post.has_liked ? 'liked' : ''}`}
            onClick={handleLike}
          >
            {post.has_liked ? '❤️' : '🤍'} 
            <span>{post.likes_count}</span>
          </button>
          
          <button 
            className="rk-action-btn"
            onClick={() => setShowComments(!showComments)}
          >
            💬 <span>{post.comments_count}</span>
          </button>
        </div>

        {canDelete && (
          <button 
            type="button" 
            className="rk-button-text rk-button-danger rk-button-small"
            onClick={() => onDelete(post.id)}
          >
            Delete
          </button>
        )}
      </div>

      {showComments && (
        <CommunityCommentSection postId={post.id} />
      )}
    </div>
  )
}
