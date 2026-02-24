import { supabaseClient } from '../supabase/client'
import { throwIfPostgrestError } from '../supabase/errors'

type UserRole = 'resident' | 'admin'

type UserRoleRecord = {
  role: UserRole | null
}

export async function getCurrentUserRole(userId: string): Promise<UserRole | null> {
  const { data, error } = await supabaseClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  throwIfPostgrestError(error)

  const role = (data as UserRoleRecord | null)?.role
  if (role === 'resident' || role === 'admin') return role
  return null
}

export async function isCurrentUserAdmin(userId: string): Promise<boolean> {
  const role = await getCurrentUserRole(userId)
  return role === 'admin'
}
