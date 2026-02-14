export function isAdminEmail(email: string | null | undefined, adminEmail: string): boolean {
  if (!email) return false
  return email.trim().toLowerCase() === adminEmail.trim().toLowerCase()
}
