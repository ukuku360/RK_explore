import { useState, type FormEvent } from 'react'
import {
  COMMUNITY_POST_CATEGORY_META,
  type CommunityPolicySnapshot,
  type CommunityPostCategory,
} from '../../../types/domain'

type Props = {
  onSubmit: (content: string, category: CommunityPostCategory) => Promise<void>
  isSubmitting: boolean
  allowedCategories: CommunityPostCategory[]
  policySnapshot: CommunityPolicySnapshot | null
  isPolicyLoading: boolean
  isAcceptingPolicy: boolean
  onAcceptPolicy: () => Promise<void>
}

const COMMUNITY_POST_MIN_LENGTH = 1
const COMMUNITY_POST_MAX_LENGTH = 280

export function CreateCommunityPost({
  onSubmit,
  isSubmitting,
  allowedCategories,
  policySnapshot,
  isPolicyLoading,
  isAcceptingPolicy,
  onAcceptPolicy,
}: Props) {
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<CommunityPostCategory>('general')
  const normalizedContent = content.trim()
  const hasAcceptedPolicy = policySnapshot?.hasAcceptedActivePolicy ?? false
  const hasAllowedCategories = allowedCategories.length > 0
  const fallbackCategory = allowedCategories[0] ?? 'general'
  const selectedCategory = allowedCategories.includes(category) ? category : fallbackCategory
  const isTooShort = normalizedContent.length > 0 && normalizedContent.length < COMMUNITY_POST_MIN_LENGTH
  const isSubmitDisabled =
    isSubmitting ||
    isPolicyLoading ||
    !hasAcceptedPolicy ||
    !hasAllowedCategories ||
    normalizedContent.length < COMMUNITY_POST_MIN_LENGTH ||
    normalizedContent.length > COMMUNITY_POST_MAX_LENGTH
  const helperToneClass = isTooShort ? 'rk-community-compose-help-error' : 'rk-community-compose-help'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isSubmitDisabled) return

    await onSubmit(normalizedContent, selectedCategory)
    setContent('')
    setCategory(fallbackCategory)
  }

  return (
    <div className="rk-card rk-community-form-card">
      <h2 className="rk-heading-2">Community Board</h2>
      <p className="rk-text-subtle">Share updates, ask for help, or offer items to neighbors.</p>
      
      <form onSubmit={handleSubmit} className="rk-community-form">
        <div className="rk-community-category-selector" role="radiogroup" aria-label="Post category">
          {allowedCategories.map((cat) => {
            const meta = COMMUNITY_POST_CATEGORY_META[cat]
            return (
              <button
                key={cat}
                type="button"
                role="radio"
                aria-checked={selectedCategory === cat}
                className={`rk-chip rk-community-category-chip ${selectedCategory === cat ? 'rk-chip-active' : ''}`}
                onClick={() => setCategory(cat)}
                disabled={isSubmitting || isPolicyLoading || !hasAcceptedPolicy}
              >
                {meta.emoji} {meta.label}
              </button>
            )
          })}
        </div>
        {!hasAllowedCategories ? (
          <p className="rk-community-policy-warning">
            No posting categories are enabled for your account. Update them in Profile first.
          </p>
        ) : null}

        <section className="rk-community-policy-panel">
          <p className="rk-community-policy-title">
            {policySnapshot?.activePolicyTitle || 'Community Terms & Conditions'}
          </p>
          <p className="rk-community-policy-summary">
            {policySnapshot?.activePolicySummary || 'Posts must match your selected category and community purpose.'}
          </p>
          {policySnapshot?.activePolicyTermsMarkdown ? (
            <details className="rk-community-policy-details">
              <summary>Read full policy</summary>
              <div className="rk-community-policy-body">{policySnapshot.activePolicyTermsMarkdown}</div>
            </details>
          ) : null}
          {isPolicyLoading ? (
            <p className="rk-feed-note">Checking policy status...</p>
          ) : hasAcceptedPolicy ? (
            <p className="rk-community-policy-accepted">Policy accepted for this account.</p>
          ) : (
            <button
              type="button"
              className="rk-button rk-button-secondary rk-button-small"
              onClick={() => void onAcceptPolicy()}
              disabled={isAcceptingPolicy}
            >
              {isAcceptingPolicy ? 'Saving agreement...' : 'Agree to Community Terms'}
            </button>
          )}
        </section>

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
            {!hasAcceptedPolicy && !isPolicyLoading
              ? 'Accept Community Terms first.'
              : normalizedContent.length === 0
              ? 'Write at least 1 character to post.'
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
