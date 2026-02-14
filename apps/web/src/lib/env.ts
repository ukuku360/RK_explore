type RequiredEnvKey = 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'

const FALLBACK_SUPABASE_URL = 'https://arbnslbtltuqzwkqbynj.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyYm5zbGJ0bHR1cXp3a3FieW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MTUyODcsImV4cCI6MjA4NjQ5MTI4N30.6cR_pFXWWMMYhYNv_NfzNNhDekH5I_u5icAEm_GbhGk'

function readRequiredEnv(key: RequiredEnvKey, fallbackValue: string): string {
  const value = import.meta.env[key]

  if (value && value.trim()) {
    return value.trim()
  }

  // Keep app bootable in environments where VITE_* variables are not configured yet.
  console.warn(`[env] Missing ${key}. Using fallback value.`)
  return fallbackValue
}

export const env = {
  supabaseUrl: readRequiredEnv('VITE_SUPABASE_URL', FALLBACK_SUPABASE_URL),
  supabaseAnonKey: readRequiredEnv('VITE_SUPABASE_ANON_KEY', FALLBACK_SUPABASE_ANON_KEY),
} as const
