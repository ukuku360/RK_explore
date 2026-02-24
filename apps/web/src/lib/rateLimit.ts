export type RateLimitConfig = {
  /** Maximum number of failures allowed within the window. */
  maxAttempts: number
  /** Rolling window in milliseconds. */
  windowMs: number
  /** Lockout duration in milliseconds after exceeding the limit. */
  lockoutMs: number
}

export type RateLimitCheck =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number }

export class RateLimiter {
  #failures: number[] = []
  #lockedUntil = 0
  #config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.#config = config
  }

  check(): RateLimitCheck {
    const now = Date.now()

    if (now < this.#lockedUntil) {
      return { allowed: false, retryAfterMs: this.#lockedUntil - now }
    }

    // Prune expired timestamps.
    const cutoff = now - this.#config.windowMs
    this.#failures = this.#failures.filter((t) => t > cutoff)

    return { allowed: true }
  }

  recordFailure(): void {
    const now = Date.now()
    this.#failures.push(now)

    // Prune and check.
    const cutoff = now - this.#config.windowMs
    this.#failures = this.#failures.filter((t) => t > cutoff)

    if (this.#failures.length >= this.#config.maxAttempts) {
      this.#lockedUntil = now + this.#config.lockoutMs
      this.#failures = []
    }
  }
}

export const LOGIN_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 60_000,
  lockoutMs: 120_000,
}

export const SIGNUP_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 3,
  windowMs: 60_000,
  lockoutMs: 120_000,
}

export function formatRetryMessage(retryAfterMs: number): string {
  const seconds = Math.ceil(retryAfterMs / 1000)
  return `Too many attempts. Please try again in ${seconds} seconds.`
}
