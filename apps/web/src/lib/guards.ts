export const ADMIN_EMAIL = 'swanston@roomingkos.com'

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return normalizeEmail(email) === ADMIN_EMAIL
}
