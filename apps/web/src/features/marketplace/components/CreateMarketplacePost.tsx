import { useEffect, useMemo, useState } from 'react'

import { INPUT_LIMITS } from '../../../lib/inputLimits'

export type MarketplacePostDraft = {
  title: string
  description: string
  askingPrice: number
  imageFile: File | null
}

type CreateMarketplacePostProps = {
  isSubmitting: boolean
  onSubmit: (draft: MarketplacePostDraft) => Promise<void> | void
}

export function CreateMarketplacePost({ isSubmitting, onSubmit }: CreateMarketplacePostProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [askingPrice, setAskingPrice] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const previewUrl = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : null), [imageFile])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const canSubmit = useMemo(() => {
    const parsedPrice = Number.parseFloat(askingPrice)
    return (
      title.trim().length >= 3 &&
      description.trim().length >= 10 &&
      Number.isFinite(parsedPrice) &&
      parsedPrice > 0 &&
      Boolean(imageFile) &&
      !isSubmitting
    )
  }, [askingPrice, description, imageFile, isSubmitting, title])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    const parsedPrice = Number.parseFloat(askingPrice)
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setErrorMessage('Enter a valid asking price above 0.')
      return
    }
    if (!imageFile) {
      setErrorMessage('Please upload one item photo.')
      return
    }

    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        askingPrice: parsedPrice,
        imageFile,
      })
      setTitle('')
      setDescription('')
      setAskingPrice('')
      setImageFile(null)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to create listing.')
    }
  }

  return (
    <section className="rk-marketplace-create rk-card">
      <div className="rk-marketplace-create-header">
        <h2>Sell Something</h2>
        <p>Post one clear item, set a fair price, and let bids compete.</p>
      </div>
      <form onSubmit={handleSubmit} className="rk-marketplace-create-form">
        <label className="rk-auth-label">
          Title
          <input
            className="rk-auth-input"
            placeholder="e.g. IKEA Study Desk"
            value={title}
            maxLength={INPUT_LIMITS.marketplace_title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={isSubmitting}
          />
        </label>
        <label className="rk-auth-label">
          Description
          <textarea
            className="rk-auth-input rk-textarea"
            placeholder="Condition, pick-up details, and what buyers should know."
            value={description}
            maxLength={INPUT_LIMITS.marketplace_description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            disabled={isSubmitting}
          />
        </label>
        <label className="rk-auth-label">
          Asking Price (AUD)
          <input
            className="rk-auth-input"
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            value={askingPrice}
            onChange={(event) => setAskingPrice(event.target.value)}
            disabled={isSubmitting}
          />
        </label>
        <label className="rk-image-upload-label rk-marketplace-image-upload">
          Upload Item Photo
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
            onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
            disabled={isSubmitting}
            hidden
          />
        </label>
        {previewUrl ? (
          <div className="rk-image-preview-wrapper">
            <img src={previewUrl} alt="Marketplace preview" className="rk-image-preview" />
            <button
              type="button"
              className="rk-image-remove-btn"
              onClick={() => setImageFile(null)}
              disabled={isSubmitting}
            >
              Remove
            </button>
          </div>
        ) : null}
        <div className="rk-marketplace-create-meta">
          <span>{description.trim().length}/{INPUT_LIMITS.marketplace_description}</span>
          <button type="submit" className="rk-button rk-button-small" disabled={!canSubmit}>
            {isSubmitting ? 'Posting...' : 'Post Listing'}
          </button>
        </div>
        {errorMessage ? <p className="rk-auth-message rk-auth-error">{errorMessage}</p> : null}
      </form>
    </section>
  )
}
