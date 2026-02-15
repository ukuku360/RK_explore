import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'

import { useAuthSession } from '../../../app/providers/auth-session-context'
import { trackEvent } from '../../../lib/analytics'
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
import { CATEGORIES, type Category, type Comment as PostComment, type Post } from '../../../types/domain'
import { usePostsWithRelationsQuery } from '../hooks/usePostsWithRelationsQuery'
import { clearDraft, hasDraftContent, loadDraft, POST_DRAFT_SAVE_DELAY_MS, saveDraft } from '../lib/postDraft'
import {
  getInitialFormState,
  getInitialStep1TouchedState,
  isStep1Valid,
  validateOptionalFields,
  validateStep1,
  type OptionalErrors,
  type PostFormState,
  type Step1Field,
} from '../lib/postForm'
import {
  getMyActivityPosts,
  hasPersonalizationData,
  rankRecommendedPosts,
  type FeedTab,
} from '../lib/personalization'
import { getRsvpSummary, isRsvpClosed, type RsvpSummary } from '../lib/rsvp'

const FEED_FILTERS = ['all', 'confirmed', 'scheduled'] as const
const SORT_OPTIONS = ['votes', 'newest', 'soonest'] as const

type FeedFilter = (typeof FEED_FILTERS)[number]
type SortOption = (typeof SORT_OPTIONS)[number]

const QUICK_TRIP_TEMPLATES = [
  { label: 'Weekend Beach', location: 'Bondi Beach' },
  { label: 'City Culture', location: 'Sydney CBD Museum Day' },
  { label: 'Food Tour', location: 'Inner West Food Walk' },
] as const

function getStatusLabel(status: 'proposed' | 'confirmed'): string {
  return status === 'confirmed' ? 'Confirmed' : 'Proposed'
}

function getCategoryEmoji(category: Category): string {
  if (category === 'Sports') return '🏀'
  if (category === 'Culture') return '🎭'
  if (category === 'Eatout') return '🍽️'
  if (category === 'Travel') return '✈️'
  if (category === 'Study') return '📚'
  return '✨'
}

function getCategoryLabel(category: Category | 'all'): string {
  if (category === 'all') return 'All'
  return `${getCategoryEmoji(category)} ${category}`
}

function getSuggestedDate(daysFromNow: number): string {
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getLetsGoTitle(location: string): string {
  const clean = location.trim()
  if (!clean) return "Let's go!"
  return `Let's go to ${clean}`
}

function getRsvpActionState(summary: RsvpSummary, isJoinClosed: boolean): {
  label: string
  helperText: string
  disabled: boolean
  isActive: boolean
} {
  if (summary.isGoing) {
    return {
      label: 'Cancel Join',
      helperText: 'Joined',
      disabled: false,
      isActive: true,
    }
  }

  if (summary.isWaitlisted) {
    return {
      label: 'Leave Waitlist',
      helperText: `Your waitlist spot #${summary.waitlistPosition}`,
      disabled: false,
      isActive: true,
    }
  }

  if (isJoinClosed) {
    return {
      label: 'Closed',
      helperText: 'Participation unavailable',
      disabled: true,
      isActive: false,
    }
  }

  if (summary.isFull) {
    return {
      label: 'Join Waitlist',
      helperText: `Current waitlist ${summary.waitlistCount}`,
      disabled: false,
      isActive: false,
    }
  }

  return {
    label: 'Join Trip',
    helperText: 'Spots available',
    disabled: false,
    isActive: false,
  }
}

type RsvpAction = 'join' | 'leave'

type EmptyStateType = 'no_data' | 'search_empty' | 'filter_overload'

type EmptyStateConfig = {
  type: EmptyStateType
  title: string
  description: string
  ctaLabel: string
}

type CommentThreadNode = PostComment & {
  replies: CommentThreadNode[]
}

function buildOptimisticRsvpSummary(summary: RsvpSummary, action: RsvpAction): RsvpSummary {
  if (action === 'join') {
    if (summary.isFull) {
      const nextWaitlistCount = summary.waitlistCount + 1
      return {
        ...summary,
        waitlistCount: nextWaitlistCount,
        isGoing: false,
        isWaitlisted: true,
        hasRsvpd: true,
        waitlistPosition: nextWaitlistCount,
      }
    }

    const nextGoingCount = Math.min(summary.capacity, summary.goingCount + 1)
    return {
      ...summary,
      goingCount: nextGoingCount,
      isFull: nextGoingCount >= summary.capacity,
      isGoing: true,
      isWaitlisted: false,
      hasRsvpd: true,
      waitlistPosition: 0,
    }
  }

  if (summary.isWaitlisted) {
    return {
      ...summary,
      waitlistCount: Math.max(summary.waitlistCount - 1, 0),
      isWaitlisted: false,
      hasRsvpd: false,
      waitlistPosition: 0,
    }
  }

  if (summary.isGoing) {
    return {
      ...summary,
      goingCount: Math.max(summary.goingCount - 1, 0),
      isFull: false,
      isGoing: false,
      hasRsvpd: false,
      waitlistPosition: 0,
    }
  }

  return summary
}

function getEmptyStateConfig(params: {
  hasAnyVisiblePost: boolean
  hasSearchText: boolean
  hasActiveFilters: boolean
}): EmptyStateConfig {
  if (!params.hasAnyVisiblePost) {
    return {
      type: 'no_data',
      title: 'No trips posted yet',
      description: 'Get the board moving with your first trip suggestion.',
      ctaLabel: 'Create first suggestion',
    }
  }

  if (params.hasSearchText) {
    return {
      type: 'search_empty',
      title: 'No results for this search',
      description: 'Try simpler keywords or switch to suggested filters.',
      ctaLabel: 'Use suggested filters',
    }
  }

  return {
    type: 'filter_overload',
    title: 'Filters are too narrow',
    description: 'Reset active filters to see more options.',
    ctaLabel: 'Reset filters',
  }
}

function buildCommentThreads(comments: PostComment[]): CommentThreadNode[] {
  const nodesById: Record<string, CommentThreadNode> = {}

  for (const comment of comments) {
    nodesById[comment.id] = { ...comment, replies: [] }
  }

  const roots: CommentThreadNode[] = []

  for (const comment of comments) {
    const node = nodesById[comment.id]
    const parentId = comment.parent_comment_id
    const parentNode = parentId && parentId !== comment.id ? nodesById[parentId] : undefined

    if (parentNode && parentNode.post_id === comment.post_id) {
      parentNode.replies.push(node)
      continue
    }

    roots.push(node)
  }

  return roots
}

export function FeedPage() {
  const { user } = useAuthSession()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const postsQuery = usePostsWithRelationsQuery({ enabled: Boolean(user) })
  const formRef = useRef<HTMLFormElement | null>(null)
  const hasTrackedPostCreateStartRef = useRef(false)
  const hasTrackedStep1ValidRef = useRef(false)

  const [form, setForm] = useState<PostFormState>(getInitialFormState)
  const [step1Touched, setStep1Touched] = useState<Record<Step1Field, boolean>>(getInitialStep1TouchedState)
  const [showStep1Errors, setShowStep1Errors] = useState(false)
  const [optionalErrors, setOptionalErrors] = useState<OptionalErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isVotePendingByPostId, setIsVotePendingByPostId] = useState<Record<string, boolean>>({})
  const [isRsvpPendingByPostId, setIsRsvpPendingByPostId] = useState<Record<string, boolean>>({})
  const [isCommentPendingByPostId, setIsCommentPendingByPostId] = useState<Record<string, boolean>>({})
  const [commentDraftByPostId, setCommentDraftByPostId] = useState<Record<string, string>>({})
  const [replyDraftByCommentId, setReplyDraftByCommentId] = useState<Record<string, string>>({})
  const [replyOpenByCommentId, setReplyOpenByCommentId] = useState<Record<string, boolean>>({})
  const [commentsOpenByPostId, setCommentsOpenByPostId] = useState<Record<string, boolean>>({})
  const [selectedCategory, setSelectedCategory] = useState<'all' | Category>('all')
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all')
  const [sortOption, setSortOption] = useState<SortOption>('votes')
  const [feedTab, setFeedTab] = useState<FeedTab>('recommended')
  const [searchText, setSearchText] = useState('')
  const [showHiddenPosts, setShowHiddenPosts] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusTone, setStatusTone] = useState<'idle' | 'error' | 'success'>('idle')
  const [optimisticRsvpByPostId, setOptimisticRsvpByPostId] = useState<Record<string, RsvpSummary>>({})
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)
  const [isMobileFabCompact, setIsMobileFabCompact] = useState(false)
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

  const hasUserSignals = useMemo(() => {
    if (!user) return false
    return hasPersonalizationData(visiblePosts, user.id)
  }, [visiblePosts, user])

  const recommendedFeed = useMemo(() => {
    if (!user || user.isAdmin) {
      return {
        rankedPosts: visiblePosts,
        metaByPostId: {} as Record<string, { score: number; reason: string }>,
      }
    }

    return rankRecommendedPosts(visiblePosts, user.id, hasUserSignals)
  }, [hasUserSignals, user, visiblePosts])

  const tabBasePosts = useMemo(() => {
    if (!user) return visiblePosts
    if (user.isAdmin) return visiblePosts

    if (feedTab === 'my_activity') {
      return getMyActivityPosts(visiblePosts, user.id)
    }

    if (feedTab === 'recommended') {
      return recommendedFeed.rankedPosts
    }

    return visiblePosts
  }, [feedTab, recommendedFeed.rankedPosts, user, visiblePosts])

  const displayPosts = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase()

    let nextPosts =
      selectedCategory === 'all' ? tabBasePosts : tabBasePosts.filter((post) => post.category === selectedCategory)

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

    if (feedTab === 'recommended' && !user?.isAdmin) {
      return nextPosts
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
  }, [feedFilter, feedTab, searchText, selectedCategory, sortOption, tabBasePosts, user?.isAdmin])

  const previewText = useMemo(() => {
    const location = form.location.trim()
    const capacity = Number(form.capacity)
    const safeCapacity = Number.isInteger(capacity) && capacity >= 1 ? capacity : 10

    if (!location) return "Where should we go next? Drop a destination and let's make a plan."
    return `${getLetsGoTitle(location)}! ${safeCapacity} spots are open.`
  }, [form.capacity, form.location])

  const step1Errors = useMemo(() => validateStep1(form), [form])
  const isStep1Complete = isStep1Valid(step1Errors)
  const hasActiveSort = (feedTab !== 'recommended' || Boolean(user?.isAdmin)) && sortOption !== 'votes'
  const hasActiveFilters =
    searchText.trim().length > 0 || selectedCategory !== 'all' || feedFilter !== 'all' || hasActiveSort
  const feedTabLabel = feedTab === 'recommended' ? 'Recommended' : feedTab === 'my_activity' ? 'My activity' : 'All'
  const feedResultLabel =
    selectedCategory === 'all'
      ? `${feedTabLabel} ${displayPosts.length}`
      : `${getCategoryLabel(selectedCategory)} ${displayPosts.length}`
  const emptyStateConfig = getEmptyStateConfig({
    hasAnyVisiblePost: visiblePosts.length > 0,
    hasSearchText: searchText.trim().length > 0,
    hasActiveFilters,
  })

  useEffect(() => {
    if (!user?.isAdmin) return
    setFeedTab('all')
  }, [user?.isAdmin])

  useEffect(() => {
    const navigationState = (location.state as { accessDenied?: string } | null) ?? null
    if (navigationState?.accessDenied !== 'admin_workspace') return

    setStatusTone('error')
    setStatusMessage('Admin workspace is restricted to admin accounts.')
    navigate(location.pathname, { replace: true })
  }, [location.pathname, location.state, navigate])

  useEffect(() => {
    if (!user) return

    const draft = loadDraft(user.id)
    if (!draft) return

    setForm(draft.form)
    setShowStep1Errors(false)
    setStep1Touched(getInitialStep1TouchedState())
    setOptionalErrors({})
    setStatusTone('success')
    setStatusMessage('Restored your draft from a previous session.')
  }, [user])

  useEffect(() => {
    if (!user) return

    if (!hasDraftContent(form)) {
      clearDraft(user.id)
      return
    }

    const timeoutId = window.setTimeout(() => {
      saveDraft(user.id, form, 1)
    }, POST_DRAFT_SAVE_DELAY_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [form, user])

  useEffect(() => {
    setOptimisticRsvpByPostId({})
  }, [postsQuery.data])

  useEffect(() => {
    if (typeof window === 'undefined') return

    let lastScrollY = window.scrollY
    const handleScroll = () => {
      const nextScrollY = window.scrollY
      const delta = nextScrollY - lastScrollY

      if (delta > 10) {
        setIsMobileFabCompact(true)
      } else if (delta < -10) {
        setIsMobileFabCompact(false)
      }

      lastScrollY = nextScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return

    let baseHeight = window.innerHeight
    const viewport = window.visualViewport

    const handleResize = () => {
      if (window.innerHeight > baseHeight) {
        baseHeight = window.innerHeight
      }

      const keyboardHeight = baseHeight - viewport.height
      setIsKeyboardOpen(keyboardHeight > 140)
    }

    viewport.addEventListener('resize', handleResize)
    handleResize()

    return () => {
      viewport.removeEventListener('resize', handleResize)
    }
  }, [])

  function trackPostCreateStartOnce() {
    if (!user || hasTrackedPostCreateStartRef.current) return

    hasTrackedPostCreateStartRef.current = true
    trackEvent('post_create_start', {
      user_id: user.id,
      role: user.isAdmin ? 'admin' : 'member',
      surface: 'post_form',
    })
  }

  function trackPostStep1ValidOnce() {
    if (!user || hasTrackedStep1ValidRef.current) return

    hasTrackedStep1ValidRef.current = true
    trackEvent('post_step1_valid', {
      user_id: user.id,
      role: user.isAdmin ? 'admin' : 'member',
      surface: 'post_form',
    })
  }

  function persistDraftNow() {
    if (!user) return

    if (!hasDraftContent(form)) {
      clearDraft(user.id)
      return
    }

    saveDraft(user.id, form, 1)
  }

  function revealStep1Errors() {
    setShowStep1Errors(true)
    setStep1Touched({
      location: true,
      proposedDate: true,
      capacity: true,
    })
  }

  function handleStep1Blur(field: Step1Field) {
    setStep1Touched((previous) => ({ ...previous, [field]: true }))
    persistDraftNow()
  }

  function handleOptionalFieldBlur(field: keyof OptionalErrors) {
    const optionalValidation = validateOptionalFields(form)
    setOptionalErrors((previous) => ({ ...previous, [field]: optionalValidation.errors[field] }))
    persistDraftNow()
  }

  function updateField<Key extends keyof PostFormState>(key: Key, value: PostFormState[Key]) {
    if (key === 'location' || key === 'proposedDate' || key === 'capacity') {
      trackPostCreateStartOnce()
    }

    if (key === 'estimatedCost' || key === 'rsvpDeadline') {
      setOptionalErrors((previous) => ({ ...previous, [key]: undefined }))
    }

    setForm((previous) => ({ ...previous, [key]: value }))
  }

  async function submitPost() {
    if (!user) {
      setStatusTone('error')
      setStatusMessage('Please log in first.')
      return
    }

    revealStep1Errors()
    if (!isStep1Complete) {
      return
    }
    trackPostStep1ValidOnce()

    const optionalValidation = validateOptionalFields(form)

    setOptionalErrors(optionalValidation.errors)

    if (Object.keys(optionalValidation.errors).length > 0) {
      return
    }

    setIsSubmitting(true)
    setStatusTone('idle')
    setStatusMessage('')

    try {
      const location = form.location.trim()
      const capacity = Number(form.capacity)

      await createPost({
        location,
        author: user.label,
        user_id: user.id,
        category: form.category,
        proposed_date: form.proposedDate,
        capacity,
        meetup_place: form.meetupPlace.trim() || null,
        meeting_time: form.meetupTime.trim() || null,
        estimated_cost: optionalValidation.values.estimatedCost,
        prep_notes: form.prepNotes.trim() || null,
        rsvp_deadline: optionalValidation.values.rsvpDeadline,
        status: 'proposed',
      })

      await invalidateAfterPostMutation(queryClient)
      await invalidateForRealtimeTable(queryClient, 'posts')

      clearDraft(user.id)
      setForm(getInitialFormState())
      setStep1Touched(getInitialStep1TouchedState())
      setOptionalErrors({})
      setShowStep1Errors(false)
      setStatusTone('success')
      setStatusMessage('Post added!')
      hasTrackedPostCreateStartRef.current = false
      hasTrackedStep1ValidRef.current = false

      trackEvent('post_create_success', {
        user_id: user.id,
        role: user.isAdmin ? 'admin' : 'member',
        surface: 'post_form',
      })
    } catch (error) {
      trackEvent('post_create_fail', {
        user_id: user.id,
        role: user.isAdmin ? 'admin' : 'member',
        reason: error instanceof Error ? error.message : 'unknown',
        surface: 'post_form',
      })
      setStatusTone('error')
      setStatusMessage(error instanceof Error ? error.message : 'Failed to post. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submitPost()
  }

  function applyFeedFilter(nextFilter: FeedFilter) {
    setFeedFilter(nextFilter)
    if (!user) return
    trackEvent('filter_applied', {
      user_id: user.id,
      role: user.isAdmin ? 'admin' : 'member',
      filter: 'feed_filter',
      value: nextFilter,
      surface: 'feed',
    })
  }

  function applyCategoryFilter(nextCategory: 'all' | Category) {
    setSelectedCategory(nextCategory)
    if (!user) return
    trackEvent('filter_applied', {
      user_id: user.id,
      role: user.isAdmin ? 'admin' : 'member',
      filter: 'category',
      value: nextCategory,
      surface: 'feed',
    })
  }

  function applySortOption(nextSort: SortOption) {
    setSortOption(nextSort)
    if (!user) return
    trackEvent('filter_applied', {
      user_id: user.id,
      role: user.isAdmin ? 'admin' : 'member',
      filter: 'sort',
      value: nextSort,
      surface: 'feed',
    })
  }

  function resetDiscoveryFilters() {
    setSearchText('')
    setSelectedCategory('all')
    setFeedFilter('all')
    setSortOption('votes')

    if (!user) return
    trackEvent('filter_cleared', {
      user_id: user.id,
      role: user.isAdmin ? 'admin' : 'member',
      surface: 'feed',
    })
  }

  function applyFeedTab(nextTab: FeedTab) {
    setFeedTab(nextTab)
    if (nextTab === 'recommended') {
      setSortOption('votes')
    }
    if (!user) return

    trackEvent('personalized_tab_viewed', {
      user_id: user.id,
      role: user.isAdmin ? 'admin' : 'member',
      tab: nextTab,
      surface: 'feed',
    })
  }

  function handleEmptyStateCta() {
    if (emptyStateConfig.type === 'filter_overload') {
      resetDiscoveryFilters()
    } else if (emptyStateConfig.type === 'search_empty') {
      setSearchText('')
      setFeedFilter('all')
      setSelectedCategory('Travel')
    } else {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    if (!user) return
    trackEvent('empty_state_cta_clicked', {
      user_id: user.id,
      role: user.isAdmin ? 'admin' : 'member',
      type: emptyStateConfig.type,
      surface: 'feed',
    })
  }

  function applyQuickTemplate(locationText: string) {
    updateField('location', locationText)
    updateField('proposedDate', getSuggestedDate(7))
    updateField('capacity', '8')
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleMobileFabClick() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (!user) return

    trackEvent('mobile_create_start', {
      user_id: user.id,
      role: user.isAdmin ? 'admin' : 'member',
      surface: 'mobile_fab',
    })
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

    const serverSummary = getRsvpSummary(post, user.id)
    const summary = optimisticRsvpByPostId[post.id] ?? serverSummary

    if (!summary.hasRsvpd && isRsvpClosed(post)) {
      setStatusTone('error')
      setStatusMessage('RSVP is closed for this trip.')
      return
    }

    const action: RsvpAction = summary.hasRsvpd ? 'leave' : 'join'
    setOptimisticRsvpByPostId((previous) => ({
      ...previous,
      [post.id]: buildOptimisticRsvpSummary(summary, action),
    }))

    setIsRsvpPendingByPostId((previous) => ({ ...previous, [post.id]: true }))

    try {
      if (action === 'leave') {
        await removeRsvp(post.id, user.id)
        await invalidateAfterRsvpMutation(queryClient)
        return
      }

      await addRsvp(post.id, user.id)
      await invalidateAfterRsvpMutation(queryClient)
    } catch (error) {
      setOptimisticRsvpByPostId((previous) => {
        const next = { ...previous }
        delete next[post.id]
        return next
      })

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

  function openReplyComposer(comment: PostComment) {
    setReplyOpenByCommentId((previous) => ({ ...previous, [comment.id]: true }))
    setReplyDraftByCommentId((previous) => {
      if (previous[comment.id]?.trim()) {
        return previous
      }

      return {
        ...previous,
        [comment.id]: `@${comment.author} `,
      }
    })
  }

  function closeReplyComposer(commentId: string) {
    setReplyOpenByCommentId((previous) => {
      const next = { ...previous }
      delete next[commentId]
      return next
    })
    setReplyDraftByCommentId((previous) => {
      const next = { ...previous }
      delete next[commentId]
      return next
    })
  }

  async function submitComment(params: { postId: string; parentComment?: PostComment }) {
    if (!user) return

    const parentCommentId = params.parentComment?.id ?? null
    const draftSource = parentCommentId
      ? replyDraftByCommentId[parentCommentId]
      : commentDraftByPostId[params.postId]
    const draft = draftSource?.trim() ?? ''
    if (!draft) return

    setIsCommentPendingByPostId((previous) => ({ ...previous, [params.postId]: true }))

    try {
      const commentPayload = {
        post_id: params.postId,
        user_id: user.id,
        author: user.label,
        text: draft,
        ...(parentCommentId ? { parent_comment_id: parentCommentId } : {}),
      }

      await createComment({
        ...commentPayload,
      })
      await invalidateAfterCommentMutation(queryClient)

      if (parentCommentId) {
        closeReplyComposer(parentCommentId)
        setStatusTone('success')
        setStatusMessage('Reply added.')
      } else {
        setCommentDraftByPostId((previous) => ({ ...previous, [params.postId]: '' }))
        setStatusTone('success')
        setStatusMessage('Comment added.')
      }
    } catch (error) {
      setStatusTone('error')
      setStatusMessage(error instanceof Error ? error.message : 'Failed to add comment.')
    } finally {
      setIsCommentPendingByPostId((previous) => ({ ...previous, [params.postId]: false }))
    }
  }

  return (
    <section className="rk-page">
      <div className="rk-page-top">
        <div>
          <h1>Create a Trip Idea</h1>
          <p>{previewText}</p>
        </div>
      </div>

      <form ref={formRef} className="rk-post-form" onSubmit={handleSubmit}>
        <div className="rk-post-grid rk-post-grid-3">
          <label className="rk-auth-label">
            Destination
            <input
              className="rk-auth-input"
              placeholder="Type a destination..."
              value={form.location}
              onChange={(event) => updateField('location', event.target.value)}
              onBlur={() => handleStep1Blur('location')}
              disabled={isSubmitting}
            />
            {showStep1Errors || step1Touched.location ? <span className="rk-field-error">{step1Errors.location}</span> : null}
          </label>

          <label className="rk-auth-label">
            Date
            <input
              className="rk-auth-input"
              type="date"
              value={form.proposedDate}
              onChange={(event) => updateField('proposedDate', event.target.value)}
              onBlur={() => handleStep1Blur('proposedDate')}
              disabled={isSubmitting}
            />
            {showStep1Errors || step1Touched.proposedDate ? (
              <span className="rk-field-error">{step1Errors.proposedDate}</span>
            ) : null}
          </label>

          <label className="rk-auth-label">
            Capacity
            <input
              className="rk-auth-input"
              type="number"
              min={1}
              max={200}
              value={form.capacity}
              onChange={(event) => updateField('capacity', event.target.value)}
              onBlur={() => handleStep1Blur('capacity')}
              disabled={isSubmitting}
            />
            {showStep1Errors || step1Touched.capacity ? <span className="rk-field-error">{step1Errors.capacity}</span> : null}
          </label>
        </div>

        <div className="rk-post-optional">
          <div className="rk-post-grid rk-post-grid-2">
            <label className="rk-auth-label">
              Category
              <select
                className="rk-auth-input"
                value={form.category}
                onChange={(event) => updateField('category', event.target.value as Category)}
                onBlur={persistDraftNow}
                disabled={isSubmitting}
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {getCategoryLabel(category)}
                  </option>
                ))}
              </select>
            </label>

            <label className="rk-auth-label">
              Meet-up place
              <input
                className="rk-auth-input"
                value={form.meetupPlace}
                onChange={(event) => updateField('meetupPlace', event.target.value)}
                onBlur={persistDraftNow}
                disabled={isSubmitting}
              />
            </label>
          </div>

          <div className="rk-post-grid rk-post-grid-2">
            <label className="rk-auth-label">
              Meet-up time
              <input
                className="rk-auth-input"
                type="time"
                value={form.meetupTime}
                onChange={(event) => updateField('meetupTime', event.target.value)}
                onBlur={persistDraftNow}
                disabled={isSubmitting}
              />
            </label>

            <label className="rk-auth-label">
              Estimated cost
              <input
                className="rk-auth-input"
                type="number"
                min={0}
                value={form.estimatedCost}
                onChange={(event) => updateField('estimatedCost', event.target.value)}
                onBlur={() => handleOptionalFieldBlur('estimatedCost')}
                disabled={isSubmitting}
              />
              <span className="rk-field-error">{optionalErrors.estimatedCost}</span>
            </label>
          </div>

          <div className="rk-post-grid rk-post-grid-2">
            <label className="rk-auth-label">
              RSVP deadline
              <input
                className="rk-auth-input"
                type="datetime-local"
                value={form.rsvpDeadline}
                onChange={(event) => updateField('rsvpDeadline', event.target.value)}
                onBlur={() => handleOptionalFieldBlur('rsvpDeadline')}
                disabled={isSubmitting}
              />
              <span className="rk-field-error">{optionalErrors.rsvpDeadline}</span>
            </label>

            <label className="rk-auth-label">
              Preparation notes
              <textarea
                className="rk-auth-input rk-textarea"
                value={form.prepNotes}
                onChange={(event) => updateField('prepNotes', event.target.value)}
                onBlur={persistDraftNow}
                disabled={isSubmitting}
              />
            </label>
          </div>
        </div>

        <div className="rk-post-step-actions">
          <button className="rk-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Publishing...' : 'Publish trip idea'}
          </button>
        </div>
      </form>

      {statusMessage ? (
        <p className={statusTone === 'error' ? 'rk-auth-message rk-auth-error' : 'rk-auth-message rk-auth-success'}>
          {statusMessage}
        </p>
      ) : null}

      <section className="rk-feed-section">
        <h2>Community Board</h2>
        {user?.isAdmin ? (
          <div className="rk-role-callout">
            <strong>Admin view is separated.</strong>
            <span>Use Admin workspace for moderation actions.</span>
            <button type="button" className="rk-chip" onClick={() => navigate('/admin')}>
              Open Admin workspace
            </button>
          </div>
        ) : (
          <div className="rk-feed-tabs" role="tablist" aria-label="Feed tabs">
            <button
              type="button"
              role="tab"
              aria-selected={feedTab === 'recommended'}
              className={`rk-chip ${feedTab === 'recommended' ? 'rk-chip-active' : ''}`}
              onClick={() => applyFeedTab('recommended')}
            >
              Recommended
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={feedTab === 'my_activity'}
              className={`rk-chip ${feedTab === 'my_activity' ? 'rk-chip-active' : ''}`}
              onClick={() => applyFeedTab('my_activity')}
            >
              My Activity
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={feedTab === 'all'}
              className={`rk-chip ${feedTab === 'all' ? 'rk-chip-active' : ''}`}
              onClick={() => applyFeedTab('all')}
            >
              All
            </button>
          </div>
        )}
        <p className="rk-feed-count">{feedResultLabel} posts</p>

        <div className="rk-filter-toolbar">
          <div className="rk-discovery">
            <input
              className="rk-post-input"
              placeholder="Where should we go next? Search destination, author, or comment..."
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
                  onClick={() => applyFeedFilter(nextFilter)}
                >
                  {nextFilter === 'all' ? 'All' : nextFilter === 'confirmed' ? 'Confirmed' : 'With Date'}
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
                onClick={() => applyCategoryFilter('all')}
              >
                All
              </button>
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`rk-chip ${selectedCategory === category ? 'rk-chip-active' : ''}`}
                  onClick={() => applyCategoryFilter(category)}
                >
                  {getCategoryLabel(category)}
                </button>
              ))}
            </div>

            {feedTab !== 'recommended' || user?.isAdmin ? (
              <div className="rk-discovery-group">
                <span>Sort</span>
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`rk-chip ${sortOption === option ? 'rk-chip-active' : ''}`}
                    onClick={() => applySortOption(option)}
                  >
                    {option === 'votes' ? 'Most Voted' : option === 'newest' ? 'Newest' : 'Soonest Date'}
                  </button>
                ))}
              </div>
            ) : (
              <div className="rk-discovery-group">
                <span>Sort</span>
                <span className="rk-feed-note">Recommended ranking is active</span>
              </div>
            )}

            {hasActiveFilters ? (
              <button
                type="button"
                className="rk-chip rk-chip-active"
                onClick={resetDiscoveryFilters}
              >
                Reset filters
              </button>
            ) : null}

            {user?.isAdmin ? (
              <button type="button" className="rk-chip" onClick={() => setShowHiddenPosts((previous) => !previous)}>
                {showHiddenPosts ? 'Hide Hidden Posts' : 'Show Hidden Posts'}
              </button>
            ) : null}
          </div>
        </div>

        {postsQuery.isLoading ? <p className="rk-feed-note">Loading suggestions...</p> : null}

        {!postsQuery.isLoading && displayPosts.length === 0 ? (
          <div className="rk-empty-state">
            <strong>{emptyStateConfig.title}</strong>
            <p>{emptyStateConfig.description}</p>
            {user?.isAdmin && !showHiddenPosts ? (
              <button
                type="button"
                className="rk-button rk-button-secondary rk-button-small"
                onClick={() => setShowHiddenPosts(true)}
              >
                Show hidden posts
              </button>
            ) : (
              <button
                type="button"
                className="rk-button rk-button-small"
                onClick={handleEmptyStateCta}
              >
                {emptyStateConfig.ctaLabel}
              </button>
            )}

            {emptyStateConfig.type === 'no_data' ? (
              <div className="rk-empty-templates">
                {QUICK_TRIP_TEMPLATES.map((template) => (
                  <button
                    key={template.label}
                    type="button"
                    className="rk-chip"
                    onClick={() => applyQuickTemplate(template.location)}
                  >
                    {template.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="rk-feed-list">
          {displayPosts.map((post) => {
            const hasVoted = post.votes.some((vote) => vote.user_id === viewerUserId)
            const baseRsvpSummary = getRsvpSummary(post, viewerUserId)
            const rsvpSummary = optimisticRsvpByPostId[post.id] ?? baseRsvpSummary
            const isClosed = isRsvpClosed(post)
            const isRsvpClosedForJoin = isClosed && !rsvpSummary.hasRsvpd
            const rsvpAction = getRsvpActionState(rsvpSummary, isRsvpClosedForJoin)
            const recommendationReason =
              feedTab === 'recommended' && !user?.isAdmin ? recommendedFeed.metaByPostId[post.id]?.reason : ''
            const deadlineDiffMs = post.rsvp_deadline ? new Date(post.rsvp_deadline).getTime() - Date.now() : null
            const isClosingSoon = deadlineDiffMs !== null && deadlineDiffMs > 0 && deadlineDiffMs <= 24 * 60 * 60 * 1000
            const remainingSeats = Math.max(rsvpSummary.capacity - rsvpSummary.goingCount, 0)
            const postedAgoLabel = formatTimeAgo(post.created_at)
            const detailItems = [
              recommendationReason ? { label: 'Recommended', value: recommendationReason } : null,
              post.meetup_place ? { label: 'Meet-up', value: post.meetup_place } : null,
              post.meeting_time ? { label: 'Time', value: formatMeetingTime(post.meeting_time) } : null,
              post.estimated_cost !== null ? { label: 'Cost', value: formatCurrency(post.estimated_cost) } : null,
              post.prep_notes ? { label: 'Prep', value: post.prep_notes } : null,
              rsvpSummary.waitlistCount > 0 ? { label: 'Waitlist', value: String(rsvpSummary.waitlistCount) } : null,
            ].filter((item): item is { label: string; value: string } => Boolean(item))
            const commentThreads = buildCommentThreads(post.comments)

            return (
              <article key={post.id} className="rk-post-card">
                {post.is_hidden ? (
                  <div className="rk-hidden-note">Hidden by admin{post.hidden_reason ? `: ${post.hidden_reason}` : '.'}</div>
                ) : null}

                <header className="rk-post-header">
                  <div className="rk-post-header-main">
                    <h3>
                      <span className="rk-location rk-location-title">
                        <span className="rk-location-emoji" aria-hidden>
                          {getCategoryEmoji(post.category)}
                        </span>
                        <span>{getLetsGoTitle(post.location)}</span>
                      </span>
                    </h3>
                    <div className="rk-post-meta">
                      <span>{post.author}</span>
                      <span>{postedAgoLabel}</span>
                      {post.proposed_date ? <span className="rk-post-date-pill">{formatDate(post.proposed_date)}</span> : null}
                    </div>
                  </div>
                  <div className="rk-status-cluster">
                    <span className={`rk-status rk-status-${post.status}`}>{getStatusLabel(post.status)}</span>
                    {isClosingSoon ? <span className="rk-status rk-status-closing">Closing Soon</span> : null}
                    {isClosed ? <span className="rk-status rk-status-closed">Closed</span> : null}
                  </div>
                </header>

                <div className="rk-card-core">
                  <div className="rk-card-core-item">
                    <span>Place</span>
                    <strong>{post.location}</strong>
                  </div>
                  <div className="rk-card-core-item">
                    <span>Date</span>
                    <strong>{post.proposed_date ? formatDate(post.proposed_date) : 'Not scheduled'}</strong>
                  </div>
                  <div className="rk-card-core-item">
                    <span>Deadline</span>
                    <strong>{post.rsvp_deadline ? formatDateTime(post.rsvp_deadline) : 'Open'}</strong>
                  </div>
                  <div className="rk-card-core-item">
                    <span>Seats left</span>
                    <strong>{remainingSeats}</strong>
                  </div>
                </div>

                <details className="rk-card-more">
                  <summary
                    onClick={() => {
                      if (!user) return
                      trackEvent('post_open', {
                        user_id: user.id,
                        role: user.isAdmin ? 'admin' : 'member',
                        post_id: post.id,
                        surface: 'feed_card',
                      })
                    }}
                  >
                    View details
                  </summary>
                  <div className="rk-card-more-list">
                    {detailItems.map((item) => (
                      <div key={`${post.id}:${item.label}`} className="rk-detail-item">
                        <span className="rk-detail-label">{item.label}</span>
                        <strong className="rk-detail-value">{item.value}</strong>
                      </div>
                    ))}
                  </div>
                </details>

                <div className="rk-post-actions">
                  <div className="rk-action-stack rk-vote-stack">
                    <button
                      type="button"
                      className={`rk-action-button rk-vote-button ${hasVoted ? 'rk-action-active' : ''}`}
                      onClick={() => void handleVote(post.id, hasVoted)}
                      disabled={isVotePendingByPostId[post.id]}
                      aria-label={hasVoted ? `Remove vote (${post.votes.length} votes)` : `Vote (${post.votes.length} votes)`}
                    >
                      <span aria-hidden>▲</span>
                    </button>
                    <span className="rk-vote-count">{post.votes.length}</span>
                  </div>
                  <div className="rk-action-stack">
                    <button
                      type="button"
                      className={`rk-action-button rk-rsvp-button ${rsvpAction.isActive ? 'rk-action-active' : ''}`}
                      onClick={() => void handleRsvp(post)}
                      disabled={isRsvpPendingByPostId[post.id] || rsvpAction.disabled}
                    >
                      {rsvpAction.label}
                    </button>
                    {rsvpAction.helperText !== 'Spots available' ? (
                      <span className="rk-action-help">{rsvpAction.helperText}</span>
                    ) : null}
                  </div>
                  <div className="rk-action-stack">
                    <button type="button" className="rk-action-button" onClick={() => toggleComments(post.id)}>
                      Comment {post.comments.length}
                    </button>
                  </div>
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
                        commentThreads.map((comment) => {
                          const renderCommentNode = (node: CommentThreadNode, depth = 0) => {
                            const isReplyOpen = Boolean(replyOpenByCommentId[node.id])
                            const replyDraft = replyDraftByCommentId[node.id] ?? ''
                            const initial = (node.author || '?').charAt(0).toUpperCase()

                            return (
                              <div key={node.id} className={`rk-comment-item ${depth > 0 ? 'rk-comment-item-reply' : ''}`}>
                                <div className="rk-comment-avatar">{initial}</div>
                                <div className="rk-comment-content">
                                  <div className="rk-comment-meta">
                                    <strong>{node.author}</strong>
                                    <div className="rk-comment-meta-actions">
                                      <span>{formatTimeAgo(node.created_at)}</span>
                                      <button
                                        type="button"
                                        className="rk-comment-reply-button"
                                        onClick={() => {
                                          if (isReplyOpen) {
                                            closeReplyComposer(node.id)
                                            return
                                          }
                                          openReplyComposer(node)
                                        }}
                                        disabled={isCommentPendingByPostId[post.id]}
                                      >
                                        {isReplyOpen ? 'Cancel' : 'Reply'}
                                      </button>
                                    </div>
                                  </div>
                                  
                                  <div className="rk-comment-bubble">
                                    {node.text}
                                  </div>

                                  {isReplyOpen ? (
                                    <div className="rk-comment-form rk-reply-form">
                                      <input
                                        className="rk-post-input"
                                        placeholder={`Reply to ${node.author}...`}
                                        value={replyDraft}
                                        onChange={(event) =>
                                          setReplyDraftByCommentId((previous) => ({
                                            ...previous,
                                            [node.id]: event.target.value,
                                          }))
                                        }
                                        onKeyDown={(event) => {
                                          if (event.key !== 'Enter') return
                                          event.preventDefault()
                                          void submitComment({ postId: post.id, parentComment: node })
                                        }}
                                        disabled={isCommentPendingByPostId[post.id]}
                                        autoFocus
                                      />
                                      <button
                                        type="button"
                                        className="rk-button rk-button-small"
                                        onClick={() => void submitComment({ postId: post.id, parentComment: node })}
                                        disabled={isCommentPendingByPostId[post.id]}
                                      >
                                        Reply
                                      </button>
                                    </div>
                                  ) : null}

                                  {node.replies.length > 0 ? (
                                    <div className="rk-comment-children">
                                      {node.replies.map((replyNode) => renderCommentNode(replyNode, depth + 1))}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            )
                          }

                          return renderCommentNode(comment)
                        })
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
                          void submitComment({ postId: post.id })
                        }}
                        disabled={isCommentPendingByPostId[post.id]}
                      />
                      <button
                        type="button"
                        className="rk-button rk-button-small"
                        onClick={() => void submitComment({ postId: post.id })}
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

      {!isKeyboardOpen ? (
        <button
          type="button"
          className={`rk-mobile-fab ${isMobileFabCompact ? 'rk-mobile-fab-compact' : ''}`}
          onClick={handleMobileFabClick}
          aria-label="Create trip suggestion"
        >
          <span className="rk-mobile-fab-icon">+</span>
          <span className="rk-mobile-fab-text">New Trip</span>
        </button>
      ) : null}
    </section>
  )
}
