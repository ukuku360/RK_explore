import type { PostgrestError } from '@supabase/supabase-js'

export function throwIfPostgrestError(error: PostgrestError | null): void {
  if (!error) return
  throw new Error(error.message)
}
