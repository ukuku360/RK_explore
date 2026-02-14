type RequiredEnvKey = 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'

function readRequiredEnv(key: RequiredEnvKey): string {
  const value = import.meta.env[key]

  if (!value || !value.trim()) {
    throw new Error(`[env] Missing required variable: ${key}`)
  }

  return value.trim()
}

export const env = {
  supabaseUrl: readRequiredEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: readRequiredEnv('VITE_SUPABASE_ANON_KEY'),
} as const
