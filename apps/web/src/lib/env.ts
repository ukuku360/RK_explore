type RequiredEnvKey = 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'
type OptionalEnvKey = 'VITE_SIGNUP_ALLOWLIST_ENABLED' | 'VITE_SIGNUP_ALLOWLIST_PATH'

const DEFAULT_SIGNUP_ALLOWLIST_PATH = '/signup-allowlist.txt'
const missingRequiredEnvKeys: RequiredEnvKey[] = []

function readRequiredEnv(key: RequiredEnvKey): string {
  const value = import.meta.env[key]

  if (value && value.trim()) {
    return value.trim()
  }

  missingRequiredEnvKeys.push(key)
  return ''
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

  // eslint-disable-next-line no-console
  console.warn(`[env] Invalid boolean for ${key}: "${value}". Using fallback value.`)
  return fallbackValue
}

export const env = {
  supabaseUrl: readRequiredEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: readRequiredEnv('VITE_SUPABASE_ANON_KEY'),
  signupAllowlistEnabled: readBooleanEnv('VITE_SIGNUP_ALLOWLIST_ENABLED', false),
  signupAllowlistPath: readOptionalEnv('VITE_SIGNUP_ALLOWLIST_PATH') ?? DEFAULT_SIGNUP_ALLOWLIST_PATH,
} as const

export const envConfigError =
  missingRequiredEnvKeys.length > 0
    ? `[env] Missing required environment variable(s): ${missingRequiredEnvKeys.join(', ')}`
    : null
