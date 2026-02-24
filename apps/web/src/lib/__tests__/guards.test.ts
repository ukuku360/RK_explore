import { describe, expect, it } from 'vitest'

import { normalizeEmail } from '../guards'

describe('normalizeEmail', () => {
  it('normalizes case and spaces', () => {
    expect(normalizeEmail('  SWANSTON@ROOMINGKOS.COM  ')).toBe('swanston@roomingkos.com')
  })

  it('handles empty-ish values', () => {
    expect(normalizeEmail('')).toBe('')
    expect(normalizeEmail(null)).toBe('')
    expect(normalizeEmail(undefined)).toBe('')
  })
})
