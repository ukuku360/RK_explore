
import { type CommunityPost } from '../../../types/domain'
import { formatDateTime } from '../../../lib/formatters'

type Props = {
  post: CommunityPost
  currentUserId?: string
  isAdmin: boolean
  onDelete: (id: string) => void
}

export function CommunityPostCard({ post, currentUserId, isAdmin, onDelete }: Props) {
  const isOwner = currentUserId === post.user_id
  const canDelete = isOwner || isAdmin

  return (
    <div className="rk-card rk-community-card">
      <div className="rk-community-header">
        <span className="rk-community-author">{post.author}</span>
        <span className="rk-community-time">{formatDateTime(post.created_at)}</span>
      </div>
      <div className="rk-community-content">{post.content}</div>
      {canDelete && (
        <div className="rk-community-actions">
          <button 
            type="button" 
            className="rk-button rk-button-text rk-button-danger rk-button-small"
            onClick={() => onDelete(post.id)}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
