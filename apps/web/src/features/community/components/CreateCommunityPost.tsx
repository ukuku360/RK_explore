
import { useState, type FormEvent } from 'react'

type Props = {
  onSubmit: (content: string) => Promise<void>
  isSubmitting: boolean
}

export function CreateCommunityPost({ onSubmit, isSubmitting }: Props) {
  const [content, setContent] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!content.trim()) return

    await onSubmit(content)
    setContent('')
  }

  return (
    <div className="rk-card rk-community-form-card">
      <h2 className="rk-heading-2">Community Board</h2>
      <p className="rk-text-subtle">Share news, ask questions, or give away items!</p>
      
      <form onSubmit={handleSubmit} className="rk-community-form">
        <textarea
          className="rk-input rk-textarea"
          rows={3}
          placeholder="What's happening? (e.g. 'Laundry done', 'Free stuff at 8F')"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={isSubmitting}
        />
        <div className="rk-form-actions">
          <button 
            type="submit" 
            className="rk-button rk-button-primary"
            disabled={isSubmitting || !content.trim()}
          >
            {isSubmitting ? 'Posting...' : 'Post to Community'}
          </button>
        </div>
      </form>
    </div>
  )
}
