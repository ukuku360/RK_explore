import { createClient } from '@supabase/supabase-js'

import { env } from '../../lib/env'

const fallbackSupabaseUrl = 'https://invalid-project-ref.supabase.co'
const fallbackSupabaseAnonKey = 'invalid-anon-key'

export const supabaseClient = createClient(
  env.supabaseUrl || fallbackSupabaseUrl,
  env.supabaseAnonKey || fallbackSupabaseAnonKey,
  {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  },
)
