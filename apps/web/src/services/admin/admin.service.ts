import { supabaseClient } from '../supabase/client'
import { throwIfPostgrestError } from '../supabase/errors'
import type { AdminAction, AdminLog } from '../../types/domain'

type CreateAdminLogInput = {
  post_id: string | null
  report_id: string | null
  action: AdminAction
  reason: string
  admin_user_id: string
  admin_email: string
}

export async function listAdminLogs(limitCount = 100): Promise<AdminLog[]> {
  const { data, error } = await supabaseClient
    .from('admin_action_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limitCount)
  throwIfPostgrestError(error)

  return (data ?? []) as AdminLog[]
}

export async function createAdminLog(input: CreateAdminLogInput): Promise<void> {
  const { error } = await supabaseClient.from('admin_action_logs').insert(input)
  throwIfPostgrestError(error)
}
