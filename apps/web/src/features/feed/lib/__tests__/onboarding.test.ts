import { describe, expect, it } from 'vitest'

import {
  classifyOnboardingUserType,
  markOnboardingShown,
  shouldShowOnboarding,
  type OnboardingState,
} from '../onboarding'

describe('onboarding helpers', () => {
  it('classifies a brand-new user without actions as new', () => {
    const userType = classifyOnboardingUserType(
      '2026-02-14T09:00:00.000Z',
      null,
      new Date('2026-02-14T12:00:00.000Z').getTime(),
    )

    expect(userType).toBe('new')
  })

  it('classifies a user with recent core action as active', () => {
    const userType = classifyOnboardingUserType(
      '2026-01-01T00:00:00.000Z',
      new Date('2026-02-10T10:00:00.000Z').getTime(),
      new Date('2026-02-14T12:00:00.000Z').getTime(),
    )

    expect(userType).toBe('active')
  })

  it('shows onboarding once for returning idle users with no state', () => {
    const result = shouldShowOnboarding(
      'returning_idle',
      false,
      null,
      new Date('2026-02-14T12:00:00.000Z').getTime(),
    )

    expect(result).toEqual({ shouldShow: true, isReshow: false })
  })

  it('re-shows onboarding after 7 days when skipped', () => {
    const state: OnboardingState = {
      lastShownAt: '2026-02-01T10:00:00.000Z',
      skippedAt: '2026-02-01T10:01:00.000Z',
    }

    const result = shouldShowOnboarding(
      'returning_idle',
      false,
      state,
      new Date('2026-02-10T12:00:00.000Z').getTime(),
    )

    expect(result).toEqual({ shouldShow: true, isReshow: true })
  })

  it('marks first show and reshow timestamps correctly', () => {
    const firstShown = markOnboardingShown(null, '2026-02-14T10:00:00.000Z', false)
    expect(firstShown.lastShownAt).toBe('2026-02-14T10:00:00.000Z')
    expect(firstShown.reexposedAt).toBeUndefined()

    const reshown = markOnboardingShown(firstShown, '2026-02-22T10:00:00.000Z', true)
    expect(reshown.reexposedAt).toBe('2026-02-22T10:00:00.000Z')
  })
})
