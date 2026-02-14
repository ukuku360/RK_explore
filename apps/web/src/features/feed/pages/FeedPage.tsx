import { useMemo, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import {
  invalidateAfterCommentMutation,
  invalidateAfterPostMutation,
  invalidateAfterRsvpMutation,
  invalidateAfterVoteMutation,
  invalidateForRealtimeTable,
} from '../../../lib/queryInvalidation'
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatMeetingTime,
  formatTimeAgo,
} from '../../../lib/formatters'
import { createComment } from '../../../services/comments/comments.service'
import { createPost } from '../../../services/posts/posts.service'
import { addRsvp, removeRsvp } from '../../../services/rsvps/rsvps.service'
import { SupabaseServiceError } from '../../../services/supabase/errors'
import { addVote, removeVote } from '../../../services/votes/votes.service'
import { CATEGORIES, type Category, type Post } from '../../../types/domain'
import { useAuthSession } from '../../../app/providers/auth-session-context'
import { usePostsWithRelationsQuery } from '../hooks/usePostsWithRelationsQuery'
import { getRsvpSummary, isRsvpClosed } from '../lib/rsvp'

const DEFAULT_CAPACITY = 10
const MAX_CAPACITY = 200
const FEED_FILTERS = ['all', 'confirmed', 'scheduled'] as const
const SORT_OPTIONS = ['votes', 'newest', 'soonest'] as const

type FeedFilter = (typeof FEED_FILTERS)[number]
type SortOption = (typeof SORT_OPTIONS)[number]

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

function getStatusLabel(status: 'proposed' | 'confirmed'): string {
  return status === 'confirmed' ? '✅ Confirmed' : '🕓 Proposed'
}

export function FeedPage() {
  const { user } = useAuthSession()
  const queryClient = useQueryClient()
  const postsQuery = usePostsWithRelationsQuery({ enabled: Boolean(user) })

  const [form, setForm] = useState<PostFormState>(getInitialFormState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isVotePendingByPostId, setIsVotePendingByPostId] = useState<Record<string, boolean>>({})
  const [isRsvpPendingByPostId, setIsRsvpPendingByPostId] = useState<Record<string, boolean>>({})
  const [isCommentPendingByPostId, setIsCommentPendingByPostId] = useState<Record<string, boolean>>({})
  const [commentDraftByPostId, setCommentDraftByPostId] = useState<Record<string, string>>({})
  const [commentsOpenByPostId, setCommentsOpenByPostId] = useState<Record<string, boolean>>({})
  const [selectedCategory, setSelectedCategory] = useState<'all' | Category>('all')
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all')
  const [sortOption, setSortOption] = useState<SortOption>('votes')
  const [searchText, setSearchText] = useState('')
  const [showHiddenPosts, setShowHiddenPosts] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusTone, setStatusTone] = useState<'idle' | 'error' | 'success'>('idle')
  const viewerUserId = user?.id ?? ''

  const visiblePosts = useMemo(() => {
    if (!postsQuery.data || !user) return []

    return postsQuery.data.filter((post) => {
      if (user.isAdmin) {
        return showHiddenPosts ? true : !post.is_hidden
      }

      if (!post.is_hidden) return true
      return post.user_id === user.id
    })
  }, [postsQuery.data, showHiddenPosts, user])

  const displayPosts = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase()

    let nextPosts = selectedCategory === 'all'
      ? visiblePosts
      : visiblePosts.filter((post) => post.category === selectedCategory)

    if (feedFilter === 'confirmed') {
      nextPosts = nextPosts.filter((post) => post.status === 'confirmed')
    } else if (feedFilter === 'scheduled') {
      nextPosts = nextPosts.filter((post) => Boolean(post.proposed_date))
    }

    if (normalizedSearch) {
      nextPosts = nextPosts.filter((post) => {
        const commentsText = post.comments.map((comment) => comment.text).join(' ')
        const haystack = [
          post.location,
          post.author,
          post.meetup_place ?? '',
          post.prep_notes ?? '',
          commentsText,
        ]
          .join(' ')
          .toLowerCase()

        return haystack.includes(normalizedSearch)
      })
    }

    const sorted = [...nextPosts]

    if (sortOption === 'votes') {
      sorted.sort((a, b) => b.votes.length - a.votes.length)
      return sorted
    }

    if (sortOption === 'newest') {
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      return sorted
    }

    sorted.sort((a, b) => {
      if (!a.proposed_date && !b.proposed_date) return 0
      if (!a.proposed_date) return 1
      if (!b.proposed_date) return -1
      return new Date(a.proposed_date).getTime() - new Date(b.proposed_date).getTime()
    })
    return sorted
  }, [feedFilter, searchText, selectedCategory, sortOption, visiblePosts])

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

  async function handleVote(postId: string, hasVoted: boolean) {
    if (!user) return

    setIsVotePendingByPostId((previous) => ({ ...previous, [postId]: true }))

    try {
      if (hasVoted) {
        await removeVote(postId, user.id)
      } else {
        await addVote(postId, user.id)
      }
      await invalidateAfterVoteMutation(queryClient)
      setStatusTone('success')
      setStatusMessage(hasVoted ? 'Vote removed.' : 'Vote added.')
    } catch (error) {
      setStatusTone('error')
      setStatusMessage(error instanceof Error ? error.message : 'Failed to update vote.')
    } finally {
      setIsVotePendingByPostId((previous) => ({ ...previous, [postId]: false }))
    }
  }

  async function handleRsvp(post: Post) {
    if (!user) return

    const summary = getRsvpSummary(post, user.id)

    if (!summary.hasRsvpd && isRsvpClosed(post)) {
      setStatusTone('error')
      setStatusMessage('RSVP is closed for this trip.')
      return
    }

    setIsRsvpPendingByPostId((previous) => ({ ...previous, [post.id]: true }))

    try {
      if (summary.hasRsvpd) {
        await removeRsvp(post.id, user.id)
        await invalidateAfterRsvpMutation(queryClient)
        setStatusTone('success')
        setStatusMessage('RSVP removed.')
        return
      }

      await addRsvp(post.id, user.id)
      await invalidateAfterRsvpMutation(queryClient)
      setStatusTone('success')
      setStatusMessage(summary.isFull ? 'Trip is full. You joined the waitlist.' : 'RSVP confirmed!')
    } catch (error) {
      if (error instanceof SupabaseServiceError && error.code === '23505') {
        setStatusTone('error')
        setStatusMessage("You have already RSVP'd to this trip.")
      } else {
        setStatusTone('error')
        setStatusMessage(error instanceof Error ? error.message : 'Failed to update RSVP.')
      }
    } finally {
      setIsRsvpPendingByPostId((previous) => ({ ...previous, [post.id]: false }))
    }
  }

  function toggleComments(postId: string) {
    setCommentsOpenByPostId((previous) => ({ ...previous, [postId]: !previous[postId] }))
  }

  async function submitComment(postId: string) {
    if (!user) return

    const draft = commentDraftByPostId[postId]?.trim() ?? ''
    if (!draft) return

    setIsCommentPendingByPostId((previous) => ({ ...previous, [postId]: true }))

    try {
      await createComment({
        post_id: postId,
        user_id: user.id,
        author: user.label,
        text: draft,
      })
      await invalidateAfterCommentMutation(queryClient)
      setCommentDraftByPostId((previous) => ({ ...previous, [postId]: '' }))
      setStatusTone('success')
      setStatusMessage('Comment added.')
    } catch (error) {
      setStatusTone('error')
      setStatusMessage(error instanceof Error ? error.message : 'Failed to add comment.')
    } finally {
      setIsCommentPendingByPostId((previous) => ({ ...previous, [postId]: false }))
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

      <section className="rk-feed-section">
        <h2>Community Feed</h2>

        <div className="rk-discovery">
          <input
            className="rk-post-input"
            placeholder="Search destination, author, or comment..."
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <div className="rk-discovery-group">
            <span>Filter</span>
            {FEED_FILTERS.map((nextFilter) => (
              <button
                key={nextFilter}
                type="button"
                className={`rk-chip ${feedFilter === nextFilter ? 'rk-chip-active' : ''}`}
                onClick={() => setFeedFilter(nextFilter)}
              >
                {nextFilter === 'all'
                  ? 'All'
                  : nextFilter === 'confirmed'
                    ? 'Confirmed'
                    : 'With Date'}
              </button>
            ))}
          </div>
        </div>

        <div className="rk-discovery rk-discovery-wrap">
          <div className="rk-discovery-group">
            <span>Category</span>
            <button
              type="button"
              className={`rk-chip ${selectedCategory === 'all' ? 'rk-chip-active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              All
            </button>
            {CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                className={`rk-chip ${selectedCategory === category ? 'rk-chip-active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="rk-discovery-group">
            <span>Sort</span>
            {SORT_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={`rk-chip ${sortOption === option ? 'rk-chip-active' : ''}`}
                onClick={() => setSortOption(option)}
              >
                {option === 'votes' ? 'Most Voted' : option === 'newest' ? 'Newest' : 'Soonest Date'}
              </button>
            ))}
          </div>

          {user?.isAdmin ? (
            <button
              type="button"
              className="rk-chip"
              onClick={() => setShowHiddenPosts((previous) => !previous)}
            >
              {showHiddenPosts ? 'Hide Hidden Posts' : 'Show Hidden Posts'}
            </button>
          ) : null}
        </div>

        {postsQuery.isLoading ? <p className="rk-feed-note">Loading suggestions...</p> : null}

        {!postsQuery.isLoading && displayPosts.length === 0 ? (
          <div className="rk-empty-state">
            <strong>{searchText.trim() ? 'No matches found' : 'No posts to show'}</strong>
            <p>
              {user?.isAdmin && !showHiddenPosts
                ? 'Try "Show Hidden Posts" to review moderated content.'
                : 'Try another filter or be the first to post.'}
            </p>
          </div>
        ) : null}

        <div className="rk-feed-list">
          {displayPosts.map((post) => {
            const hasVoted = post.votes.some((vote) => vote.user_id === viewerUserId)
            const rsvpSummary = getRsvpSummary(post, viewerUserId)
            const isClosed = isRsvpClosed(post)
            const isRsvpClosedForJoin = isClosed && !rsvpSummary.hasRsvpd

            let rsvpButtonLabel = "I'm in"
            if (rsvpSummary.isGoing) {
              rsvpButtonLabel = 'Leave'
            } else if (rsvpSummary.isWaitlisted) {
              rsvpButtonLabel = 'Leave Waitlist'
            } else if (isRsvpClosedForJoin) {
              rsvpButtonLabel = 'RSVP Closed'
            } else if (rsvpSummary.isFull) {
              rsvpButtonLabel = 'Join Waitlist'
            }

            return (
            <article key={post.id} className="rk-post-card">
              {post.is_hidden ? (
                <div className="rk-hidden-note">
                  Hidden by admin{post.hidden_reason ? `: ${post.hidden_reason}` : '.'}
                </div>
              ) : null}

              <header className="rk-post-header">
                <div>
                  <h3>
                    Let&apos;s go to <span className="rk-location">{post.location}</span>!
                  </h3>
                  <div className="rk-post-meta">
                    <span>👤 {post.author}</span>
                    <span>🕐 {formatTimeAgo(post.created_at)}</span>
                  </div>
                </div>
                <span className={`rk-status rk-status-${post.status}`}>{getStatusLabel(post.status)}</span>
              </header>

              <div className="rk-badges">
                <span className="rk-badge">{post.category}</span>
                {post.proposed_date ? <span className="rk-badge">📅 {formatDate(post.proposed_date)}</span> : null}
              </div>

              <div className="rk-post-details">
                <span>▲ {post.votes.length} votes</span>
                <span>💬 {post.comments.length} comments</span>
                <span>
                  👥 {rsvpSummary.goingCount}/{rsvpSummary.capacity} going
                </span>
                {rsvpSummary.waitlistCount > 0 ? <span>⏳ {rsvpSummary.waitlistCount} waitlist</span> : null}
                {post.meetup_place ? <span>Meet-up: {post.meetup_place}</span> : null}
                {post.meeting_time ? <span>Time: {formatMeetingTime(post.meeting_time)}</span> : null}
                {post.estimated_cost !== null ? <span>Cost: {formatCurrency(post.estimated_cost)}</span> : null}
                {post.rsvp_deadline ? <span>Deadline: {formatDateTime(post.rsvp_deadline)}</span> : null}
                {post.prep_notes ? <span>Prep: {post.prep_notes}</span> : null}
              </div>

              <div className="rk-post-actions">
                <button
                  type="button"
                  className={`rk-action-button ${rsvpSummary.isGoing ? 'rk-action-active' : ''}`}
                  onClick={() => void handleRsvp(post)}
                  disabled={isRsvpPendingByPostId[post.id] || isRsvpClosedForJoin}
                >
                  {rsvpButtonLabel}
                </button>
                <button
                  type="button"
                  className={`rk-action-button ${hasVoted ? 'rk-action-active' : ''}`}
                  onClick={() => void handleVote(post.id, hasVoted)}
                  disabled={isVotePendingByPostId[post.id]}
                >
                  ▲ {post.votes.length}
                </button>
                <button
                  type="button"
                  className="rk-action-button"
                  onClick={() => toggleComments(post.id)}
                >
                  💬 {post.comments.length}
                </button>
              </div>

              {rsvpSummary.waitlistPosition > 0 ? (
                <div className="rk-note">You are #{rsvpSummary.waitlistPosition} on the waitlist.</div>
              ) : null}
              {isClosed ? <div className="rk-note">RSVP is closed for this trip.</div> : null}

              {commentsOpenByPostId[post.id] ? (
                <div className="rk-comments">
                  <div className="rk-comment-list">
                    {post.comments.length === 0 ? (
                      <p className="rk-feed-note">No comments yet.</p>
                    ) : (
                      post.comments.map((comment) => (
                        <div key={comment.id} className="rk-comment-item">
                          <div className="rk-comment-meta">
                            <strong>{comment.author}</strong>
                            <span>{formatTimeAgo(comment.created_at)}</span>
                          </div>
                          <p>{comment.text}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="rk-comment-form">
                    <input
                      className="rk-post-input"
                      placeholder="Write a comment..."
                      value={commentDraftByPostId[post.id] ?? ''}
                      onChange={(event) =>
                        setCommentDraftByPostId((previous) => ({
                          ...previous,
                          [post.id]: event.target.value,
                        }))
                      }
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return
                        event.preventDefault()
                        void submitComment(post.id)
                      }}
                      disabled={isCommentPendingByPostId[post.id]}
                    />
                    <button
                      type="button"
                      className="rk-button rk-button-small"
                      onClick={() => void submitComment(post.id)}
                      disabled={isCommentPendingByPostId[post.id]}
                    >
                      Post
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
            )
          })}
        </div>
      </section>
    </section>
  )
}
