import { describe, expect, it } from 'vitest'

import {
  getInitialFormState,
  hasOptionalData,
  isStep1Valid,
  validateOptionalFields,
  validateStep1,
} from '../postForm'

describe('post form helpers', () => {
  it('validates required step-1 fields', () => {
    const form = {
      ...getInitialFormState(),
      location: 'A',
      proposedDate: '',
      capacity: '0',
    }

    const errors = validateStep1(form, new Date('2026-02-14T10:00:00.000Z'))
    expect(errors.location).toBeTruthy()
    expect(errors.proposedDate).toBeTruthy()
    expect(errors.capacity).toBeTruthy()
    expect(isStep1Valid(errors)).toBe(false)
  })

  it('accepts valid step-1 values', () => {
    const form = {
      ...getInitialFormState(),
      location: 'Jeju',
      proposedDate: '2026-03-01',
      capacity: '8',
    }

    const errors = validateStep1(form, new Date('2026-02-14T10:00:00.000Z'))
    expect(errors).toEqual({})
    expect(isStep1Valid(errors)).toBe(true)
  })

  it('validates optional RSVP deadline against trip date', () => {
    const form = {
      ...getInitialFormState(),
      proposedDate: '2026-03-01',
      rsvpDeadline: '2026-03-05T10:00',
    }

    const result = validateOptionalFields(form)
    expect(result.errors.rsvpDeadline).toContain('before the trip date')
  })

  it('detects whether optional data exists', () => {
    const base = getInitialFormState()
    expect(hasOptionalData(base)).toBe(false)

    const withOptional = { ...base, prepNotes: 'Bring snacks' }
    expect(hasOptionalData(withOptional)).toBe(true)
  })
})
