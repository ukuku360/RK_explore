import { describe, expect, it } from 'vitest'

import { ADMIN_EMAIL, isAdminEmail } from '../guards'

describe('isAdminEmail', () => {
  it('accepts hardcoded admin email', () => {
    expect(isAdminEmail(ADMIN_EMAIL)).toBe(true)
  })

  it('normalizes case and spaces', () => {
    expect(isAdminEmail('  SWANSTON@ROOMINGKOS.COM  ')).toBe(true)
  })

  it('rejects non-admin emails', () => {
    expect(isAdminEmail('member@example.com')).toBe(false)
    expect(isAdminEmail('')).toBe(false)
    expect(isAdminEmail(null)).toBe(false)
  })
})
