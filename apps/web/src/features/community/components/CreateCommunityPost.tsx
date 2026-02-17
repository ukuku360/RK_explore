
import { useState, type FormEvent } from 'react'

type Props = {
  onSubmit: (content: string) => Promise<void>
  isSubmitting: boolean
}

const COMMUNITY_POST_MIN_LENGTH = 3
const COMMUNITY_POST_MAX_LENGTH = 280

export function CreateCommunityPost({ onSubmit, isSubmitting }: Props) {
  const [content, setContent] = useState('')
  const normalizedContent = content.trim()
  const isTooShort = normalizedContent.length > 0 && normalizedContent.length < COMMUNITY_POST_MIN_LENGTH
  const isSubmitDisabled =
    isSubmitting ||
    normalizedContent.length < COMMUNITY_POST_MIN_LENGTH ||
    normalizedContent.length > COMMUNITY_POST_MAX_LENGTH
  const helperToneClass = isTooShort ? 'rk-community-compose-help-error' : 'rk-community-compose-help'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isSubmitDisabled) return

    await onSubmit(normalizedContent)
    setContent('')
  }

  return (
    <div className="rk-card rk-community-form-card">
      <h2 className="rk-heading-2">Community Board</h2>
      <p className="rk-text-subtle">Share updates, ask for help, or offer items to neighbors.</p>
      
      <form onSubmit={handleSubmit} className="rk-community-form">
        <textarea
          className="rk-input rk-textarea"
          rows={3}
          placeholder="What's happening? (e.g. 'Laundry done', 'Free stuff at 8F')"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={COMMUNITY_POST_MAX_LENGTH}
          disabled={isSubmitting}
        />
        <div className="rk-community-compose-meta">
          <span className={helperToneClass}>
            {isTooShort
              ? `Write at least ${COMMUNITY_POST_MIN_LENGTH} characters.`
              : 'Tip: include location or time so people can respond quickly.'}
          </span>
          <span className="rk-community-compose-count">
            {normalizedContent.length}/{COMMUNITY_POST_MAX_LENGTH}
          </span>
        </div>
        <div className="rk-form-actions">
          <button 
            type="submit" 
            className="rk-button rk-button-primary"
            disabled={isSubmitDisabled}
          >
            {isSubmitting ? 'Posting...' : 'Post to Community'}
          </button>
        </div>
      </form>
    </div>
  )
}
