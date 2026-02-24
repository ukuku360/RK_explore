/**
 * Resolve the post-authentication redirect target from router state.
 * Guards against open-redirect attacks (protocol-relative URLs, backslash
 * bypasses, encoded sequences, and foreign hosts).
 */
export function resolvePostAuthRedirect(state: unknown): string {
  if (!state || typeof state !== 'object') return '/'

  const redirectTo = (state as { redirectTo?: unknown }).redirectTo
  if (typeof redirectTo !== 'string') return '/'

  // Normalise backslashes so `\/example.com` cannot bypass the checks.
  const normalized = redirectTo.replace(/\\/g, '/')

  if (!normalized.startsWith('/')) return '/'
  if (normalized.startsWith('//')) return '/'
  if (normalized.startsWith('/auth')) return '/'

  // Decode percent-encoded characters and re-check for bypass attempts.
  try {
    const decoded = decodeURIComponent(normalized)
    if (decoded.startsWith('//')) return '/'
    if (decoded !== normalized && decoded.replace(/\\/g, '/').startsWith('//')) return '/'
  } catch {
    // Malformed URI — reject.
    return '/'
  }

  // Final safety net: ensure the URL doesn't resolve to a foreign host.
  try {
    const url = new URL(normalized, window.location.origin)
    if (url.origin !== window.location.origin) return '/'
  } catch {
    return '/'
  }

  return normalized
}
