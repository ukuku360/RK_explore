import type { PostgrestError } from '@supabase/supabase-js'

export class SupabaseServiceError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'SupabaseServiceError'
    this.code = code
  }
}

export function throwIfPostgrestError(error: PostgrestError | null): void {
  if (!error) return
  throw new SupabaseServiceError(error.message, error.code)
}
