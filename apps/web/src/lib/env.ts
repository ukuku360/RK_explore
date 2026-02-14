type RequiredEnvKey = 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'
type OptionalEnvKey = 'VITE_SIGNUP_ALLOWLIST_ENABLED' | 'VITE_SIGNUP_ALLOWLIST_PATH'

const FALLBACK_SUPABASE_URL = 'https://arbnslbtltuqzwkqbynj.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyYm5zbGJ0bHR1cXp3a3FieW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MTUyODcsImV4cCI6MjA4NjQ5MTI4N30.6cR_pFXWWMMYhYNv_NfzNNhDekH5I_u5icAEm_GbhGk'
const DEFAULT_SIGNUP_ALLOWLIST_PATH = '/signup-allowlist.txt'

function readRequiredEnv(key: RequiredEnvKey, fallbackValue: string): string {
  const value = import.meta.env[key]

  if (value && value.trim()) {
    return value.trim()
  }

  // Keep app bootable in environments where VITE_* variables are not configured yet.
  console.warn(`[env] Missing ${key}. Using fallback value.`)
  return fallbackValue
}

function readOptionalEnv(key: OptionalEnvKey): string | null {
  const value = import.meta.env[key]
  if (!value || !value.trim()) return null
  return value.trim()
}

function readBooleanEnv(key: OptionalEnvKey, fallbackValue: boolean): boolean {
  const value = readOptionalEnv(key)
  if (!value) return fallbackValue

  const normalized = value.toLowerCase()
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
    return true
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false
  }

  console.warn(`[env] Invalid boolean for ${key}: "${value}". Using fallback value.`)
  return fallbackValue
}

export const env = {
  supabaseUrl: readRequiredEnv('VITE_SUPABASE_URL', FALLBACK_SUPABASE_URL),
  supabaseAnonKey: readRequiredEnv('VITE_SUPABASE_ANON_KEY', FALLBACK_SUPABASE_ANON_KEY),
  signupAllowlistEnabled: readBooleanEnv('VITE_SIGNUP_ALLOWLIST_ENABLED', false),
  signupAllowlistPath: readOptionalEnv('VITE_SIGNUP_ALLOWLIST_PATH') ?? DEFAULT_SIGNUP_ALLOWLIST_PATH,
} as const
