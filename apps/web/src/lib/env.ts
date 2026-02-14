type RequiredEnvKey = 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'

function readRequiredEnv(key: RequiredEnvKey): string {
  const value = import.meta.env[key]

  if (!value || !value.trim()) {
    throw new Error(`[env] Missing required variable: ${key}`)
  }

  return value.trim()
}

function readOptionalEnv(value: string | undefined, fallback: string): string {
  const cleanValue = value?.trim()
  return cleanValue && cleanValue.length > 0 ? cleanValue : fallback
}

export const env = {
  supabaseUrl: readRequiredEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: readRequiredEnv('VITE_SUPABASE_ANON_KEY'),
  adminEmail: readOptionalEnv(import.meta.env.VITE_ADMIN_EMAIL, 'swanston@roomingkos.com').toLowerCase(),
} as const
