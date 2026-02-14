/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SIGNUP_ALLOWLIST_ENABLED?: string
  readonly VITE_SIGNUP_ALLOWLIST_PATH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
