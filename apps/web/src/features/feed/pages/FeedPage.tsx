import { useMemo, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import {
  invalidateAfterPostMutation,
  invalidateForRealtimeTable,
} from '../../../lib/queryInvalidation'
import { createPost } from '../../../services/posts/posts.service'
import { CATEGORIES, type Category } from '../../../types/domain'
import { useAuthSession } from '../../../app/providers/auth-session-context'
import { usePostsWithRelationsQuery } from '../hooks/usePostsWithRelationsQuery'

const DEFAULT_CAPACITY = 10
const MAX_CAPACITY = 200

type PostFormState = {
  location: string
  category: Category
  proposedDate: string
  capacity: string
  meetupPlace: string
  meetupTime: string
  estimatedCost: string
  rsvpDeadline: string
  prepNotes: string
}

function getInitialFormState(): PostFormState {
  return {
    location: '',
    category: 'Travel',
    proposedDate: '',
    capacity: String(DEFAULT_CAPACITY),
    meetupPlace: '',
    meetupTime: '',
    estimatedCost: '',
    rsvpDeadline: '',
    prepNotes: '',
  }
}

function parseEstimatedCost(rawValue: string): number | null {
  const value = rawValue.trim()
  if (!value) return null

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Estimated cost must be 0 or higher.')
  }

  return parsed
}

function parseRsvpDeadlineIso(rawValue: string): string | null {
  const value = rawValue.trim()
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Please provide a valid RSVP deadline.')
  }

  return date.toISOString()
}

export function FeedPage() {
  const { user } = useAuthSession()
  const queryClient = useQueryClient()
  const postsQuery = usePostsWithRelationsQuery({ enabled: Boolean(user) })

  const [form, setForm] = useState<PostFormState>(getInitialFormState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusTone, setStatusTone] = useState<'idle' | 'error' | 'success'>('idle')

  const previewText = useMemo(() => {
    const location = form.location.trim()
    const capacity = Number.parseInt(form.capacity, 10)
    const safeCapacity =
      Number.isFinite(capacity) && capacity >= 1 && capacity <= MAX_CAPACITY ? capacity : DEFAULT_CAPACITY

    if (!location) return "Let's go to _______! 🚀"
    return `Let's go to ${location}! 🚀 (${safeCapacity} spots)`
  }, [form.capacity, form.location])

  function updateField<Key extends keyof PostFormState>(key: Key, value: PostFormState[Key]) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!user) {
      setStatusTone('error')
      setStatusMessage('Please log in first.')
      return
    }

    const location = form.location.trim()
    if (!location) {
      setStatusTone('error')
      setStatusMessage('Please enter a destination.')
      return
    }

    const capacity = Number.parseInt(form.capacity, 10)
    if (!Number.isFinite(capacity) || capacity < 1 || capacity > MAX_CAPACITY) {
      setStatusTone('error')
      setStatusMessage(`Capacity must be between 1 and ${MAX_CAPACITY}.`)
      return
    }

    let estimatedCost: number | null
    let rsvpDeadline: string | null

    try {
      estimatedCost = parseEstimatedCost(form.estimatedCost)
      rsvpDeadline = parseRsvpDeadlineIso(form.rsvpDeadline)
    } catch (error) {
      setStatusTone('error')
      setStatusMessage(error instanceof Error ? error.message : 'Please check form inputs.')
      return
    }

    if (rsvpDeadline && new Date(rsvpDeadline).getTime() < Date.now()) {
      setStatusTone('error')
      setStatusMessage('RSVP deadline must be in the future.')
      return
    }

    if (rsvpDeadline && form.proposedDate) {
      const latestAllowed = new Date(`${form.proposedDate}T23:59:59`)
      if (new Date(rsvpDeadline) > latestAllowed) {
        setStatusTone('error')
        setStatusMessage('RSVP deadline should be before the trip date.')
        return
      }
    }

    setIsSubmitting(true)
    setStatusTone('idle')
    setStatusMessage('')

    try {
      await createPost({
        location,
        author: user.label,
        user_id: user.id,
        category: form.category,
        proposed_date: form.proposedDate || null,
        capacity,
        meetup_place: form.meetupPlace.trim() || null,
        meeting_time: form.meetupTime.trim() || null,
        estimated_cost: estimatedCost,
        prep_notes: form.prepNotes.trim() || null,
        rsvp_deadline: rsvpDeadline,
        status: 'proposed',
      })

      await invalidateAfterPostMutation(queryClient)
      await invalidateForRealtimeTable(queryClient, 'posts')
      setForm(getInitialFormState())
      setStatusTone('success')
      setStatusMessage('Post added!')
    } catch (error) {
      setStatusTone('error')
      setStatusMessage(error instanceof Error ? error.message : 'Failed to post. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="rk-page">
      <h1>Suggest a Trip</h1>
      <p>{previewText}</p>

      <form className="rk-post-form" onSubmit={handleSubmit}>
        <div className="rk-post-row">
          <input
            className="rk-post-input"
            placeholder="Type a destination..."
            value={form.location}
            onChange={(event) => updateField('location', event.target.value)}
            disabled={isSubmitting}
          />
          <button className="rk-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Posting...' : 'Post'}
          </button>
        </div>

        <div className="rk-post-grid rk-post-grid-3">
          <label className="rk-auth-label">
            Category
            <select
              className="rk-auth-input"
              value={form.category}
              onChange={(event) => updateField('category', event.target.value as Category)}
              disabled={isSubmitting}
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="rk-auth-label">
            Proposed date
            <input
              className="rk-auth-input"
              type="date"
              value={form.proposedDate}
              onChange={(event) => updateField('proposedDate', event.target.value)}
              disabled={isSubmitting}
            />
          </label>

          <label className="rk-auth-label">
            Capacity
            <input
              className="rk-auth-input"
              type="number"
              min={1}
              max={MAX_CAPACITY}
              value={form.capacity}
              onChange={(event) => updateField('capacity', event.target.value)}
              disabled={isSubmitting}
            />
          </label>
        </div>

        <div className="rk-post-grid rk-post-grid-2">
          <label className="rk-auth-label">
            Meet-up place
            <input
              className="rk-auth-input"
              value={form.meetupPlace}
              onChange={(event) => updateField('meetupPlace', event.target.value)}
              disabled={isSubmitting}
            />
          </label>

          <label className="rk-auth-label">
            Meet-up time
            <input
              className="rk-auth-input"
              type="time"
              value={form.meetupTime}
              onChange={(event) => updateField('meetupTime', event.target.value)}
              disabled={isSubmitting}
            />
          </label>
        </div>

        <div className="rk-post-grid rk-post-grid-2">
          <label className="rk-auth-label">
            Estimated cost
            <input
              className="rk-auth-input"
              type="number"
              min={0}
              value={form.estimatedCost}
              onChange={(event) => updateField('estimatedCost', event.target.value)}
              disabled={isSubmitting}
            />
          </label>

          <label className="rk-auth-label">
            RSVP deadline
            <input
              className="rk-auth-input"
              type="datetime-local"
              value={form.rsvpDeadline}
              onChange={(event) => updateField('rsvpDeadline', event.target.value)}
              disabled={isSubmitting}
            />
          </label>
        </div>

        <label className="rk-auth-label">
          Preparation notes
          <textarea
            className="rk-auth-input rk-textarea"
            value={form.prepNotes}
            onChange={(event) => updateField('prepNotes', event.target.value)}
            disabled={isSubmitting}
          />
        </label>
      </form>

      {statusMessage ? (
        <p className={statusTone === 'error' ? 'rk-auth-message rk-auth-error' : 'rk-auth-message rk-auth-success'}>
          {statusMessage}
        </p>
      ) : null}

      <div className="rk-panel">
        <strong>Feed migration progress</strong>
        <p>{postsQuery.data?.length ?? 0} posts loaded. Card/action parity moves in RKM-016~RKM-019.</p>
      </div>
    </section>
  )
}
