import { env } from './env'

const NOT_ALLOWED_MESSAGE =
  'This email is not eligible for signup yet. Please contact RoomingKos staff.'
const MISCONFIGURED_MESSAGE =
  'Signup is temporarily unavailable. Please contact RoomingKos staff.'

type ParsedAllowlist = {
  emails: Set<string>
  hashedEmails: Set<string>
}

type SignupAllowlistCheck = {
  ok: boolean
  message?: string
}

let allowlistPromise: Promise<ParsedAllowlist> | null = null

function isSha256Hex(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value)
}

function parseAllowlistToken(rawToken: string, parsed: ParsedAllowlist): void {
  const token = rawToken.trim().toLowerCase()
  if (!token) return

  if (token.startsWith('sha256:')) {
    const hash = token.slice('sha256:'.length)
    if (isSha256Hex(hash)) {
      parsed.hashedEmails.add(hash)
    }
    return
  }

  if (isSha256Hex(token)) {
    parsed.hashedEmails.add(token)
    return
  }

  if (token.includes('@')) {
    parsed.emails.add(token)
  }
}

function parseAllowlistText(text: string): ParsedAllowlist {
  const parsed: ParsedAllowlist = {
    emails: new Set<string>(),
    hashedEmails: new Set<string>(),
  }

  const lines = text.split('\n')

  for (const rawLine of lines) {
    const line = rawLine.split('#')[0]?.trim() ?? ''
    if (!line) continue

    const tokens = line.split(/[,\s]+/)
    for (const token of tokens) {
      parseAllowlistToken(token, parsed)
    }
  }

  return parsed
}

function normalizeSignupEmail(email: string): string {
  return email.trim().toLowerCase()
}

async function hashEmail(email: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API is unavailable in this browser context.')
  }

  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(email))
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
}

async function loadSignupAllowlist(): Promise<ParsedAllowlist> {
  const response = await fetch(env.signupAllowlistPath, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Unable to load signup allowlist (${response.status}).`)
  }

  const parsed = parseAllowlistText(await response.text())
  if (parsed.emails.size === 0 && parsed.hashedEmails.size === 0) {
    throw new Error('Signup allowlist is empty.')
  }

  return parsed
}

function getAllowlistPromise(): Promise<ParsedAllowlist> {
  if (!allowlistPromise) {
    allowlistPromise = loadSignupAllowlist().catch((error) => {
      allowlistPromise = null
      throw error
    })
  }
  return allowlistPromise
}

export function warmSignupAllowlist(): void {
  if (!env.signupAllowlistEnabled) return
  void getAllowlistPromise()
}

export async function ensureSignupEmailAllowed(email: string): Promise<SignupAllowlistCheck> {
  if (!env.signupAllowlistEnabled) {
    return { ok: true }
  }

  try {
    const normalizedEmail = normalizeSignupEmail(email)
    const allowlist = await getAllowlistPromise()

    if (allowlist.emails.has(normalizedEmail)) {
      return { ok: true }
    }

    if (allowlist.hashedEmails.size > 0) {
      const hashedEmail = await hashEmail(normalizedEmail)
      if (allowlist.hashedEmails.has(hashedEmail)) {
        return { ok: true }
      }
    }

    return { ok: false, message: NOT_ALLOWED_MESSAGE }
  } catch (error) {
    console.error('[signup-allowlist] validation failed', error)
    return {
      ok: false,
      message: import.meta.env.DEV
        ? `${MISCONFIGURED_MESSAGE} (${error instanceof Error ? error.message : 'unknown error'})`
        : MISCONFIGURED_MESSAGE,
    }
  }
}
