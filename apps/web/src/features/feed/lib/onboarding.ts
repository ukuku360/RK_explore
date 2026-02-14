import type { Post } from '../../../types/domain'

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const ONBOARDING_NEW_USER_WINDOW_MS = ONE_DAY_MS
const ONBOARDING_ACTIVE_WINDOW_MS = 14 * ONE_DAY_MS
const ONBOARDING_REEXPOSE_WINDOW_MS = 7 * ONE_DAY_MS

export type OnboardingUserType = 'new' | 'returning_idle' | 'active'

export type OnboardingState = {
  completedAt?: string
  skippedAt?: string
  lastShownAt?: string
  reexposedAt?: string
}

function getOnboardingStorageKey(userId: string): string {
  return `rk:onboarding:v1:${userId}`
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function parseDateMs(value: string | undefined): number | null {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

function parseStoredOnboardingState(rawValue: string | null): OnboardingState | null {
  if (!rawValue) return null

  try {
    const parsed = JSON.parse(rawValue) as OnboardingState

    return {
      completedAt: parsed.completedAt,
      skippedAt: parsed.skippedAt,
      lastShownAt: parsed.lastShownAt,
      reexposedAt: parsed.reexposedAt,
    }
  } catch {
    return null
  }
}

export function loadOnboardingState(userId: string): OnboardingState | null {
  if (!canUseStorage()) return null

  try {
    return parseStoredOnboardingState(window.localStorage.getItem(getOnboardingStorageKey(userId)))
  } catch {
    return null
  }
}

export function saveOnboardingState(userId: string, state: OnboardingState): void {
  if (!canUseStorage()) return

  try {
    window.localStorage.setItem(getOnboardingStorageKey(userId), JSON.stringify(state))
  } catch {
    // Ignore storage write failures.
  }
}

export function getLatestCoreActionAtMs(posts: Post[], userId: string): number | null {
  let latestActionMs: number | null = null

  for (const post of posts) {
    if (post.user_id === userId) {
      const postCreatedMs = new Date(post.created_at).getTime()
      if (Number.isFinite(postCreatedMs) && (latestActionMs === null || postCreatedMs > latestActionMs)) {
        latestActionMs = postCreatedMs
      }
    }

    for (const vote of post.votes) {
      if (vote.user_id !== userId) continue
      const voteCreatedMs = new Date(vote.created_at).getTime()
      if (Number.isFinite(voteCreatedMs) && (latestActionMs === null || voteCreatedMs > latestActionMs)) {
        latestActionMs = voteCreatedMs
      }
    }

    for (const rsvp of post.rsvps) {
      if (rsvp.user_id !== userId) continue
      const rsvpCreatedMs = new Date(rsvp.created_at).getTime()
      if (Number.isFinite(rsvpCreatedMs) && (latestActionMs === null || rsvpCreatedMs > latestActionMs)) {
        latestActionMs = rsvpCreatedMs
      }
    }
  }

  return latestActionMs
}

export function classifyOnboardingUserType(
  userCreatedAt: string,
  latestCoreActionAtMs: number | null,
  nowMs = Date.now(),
): OnboardingUserType {
  const createdAtMs = new Date(userCreatedAt).getTime()
  const hasRecentCoreAction =
    latestCoreActionAtMs !== null && nowMs - latestCoreActionAtMs <= ONBOARDING_ACTIVE_WINDOW_MS

  if (hasRecentCoreAction) {
    return 'active'
  }

  if (latestCoreActionAtMs === null && Number.isFinite(createdAtMs)) {
    const isNew = nowMs - createdAtMs <= ONBOARDING_NEW_USER_WINDOW_MS
    if (isNew) {
      return 'new'
    }
  }

  return 'returning_idle'
}

export function shouldShowOnboarding(
  userType: OnboardingUserType,
  hasCoreAction: boolean,
  state: OnboardingState | null,
  nowMs = Date.now(),
): { shouldShow: boolean; isReshow: boolean } {
  if (hasCoreAction || userType === 'active') {
    return { shouldShow: false, isReshow: false }
  }

  if (!state?.lastShownAt && !state?.completedAt && !state?.skippedAt) {
    return { shouldShow: true, isReshow: false }
  }

  if (state?.completedAt) {
    return { shouldShow: false, isReshow: false }
  }

  const skippedAtMs = parseDateMs(state?.skippedAt)
  if (!skippedAtMs) {
    return { shouldShow: false, isReshow: false }
  }

  const hasReexposed = Boolean(state?.reexposedAt)
  if (!hasReexposed && nowMs - skippedAtMs >= ONBOARDING_REEXPOSE_WINDOW_MS) {
    return { shouldShow: true, isReshow: true }
  }

  return { shouldShow: false, isReshow: false }
}

export function markOnboardingShown(
  state: OnboardingState | null,
  shownAtIso: string,
  isReshow: boolean,
): OnboardingState {
  return {
    ...state,
    lastShownAt: shownAtIso,
    ...(isReshow ? { reexposedAt: shownAtIso } : null),
  }
}

export function markOnboardingSkipped(state: OnboardingState | null, skippedAtIso: string): OnboardingState {
  return {
    ...state,
    skippedAt: skippedAtIso,
  }
}

export function markOnboardingCompleted(state: OnboardingState | null, completedAtIso: string): OnboardingState {
  return {
    ...state,
    completedAt: completedAtIso,
  }
}
