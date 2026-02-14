import { supabaseClient } from '../supabase/client'
import { throwIfPostgrestError } from '../supabase/errors'
import type { Report, ReportStatus } from '../../types/domain'

type CreateReportInput = {
  post_id: string
  reporter_user_id: string
  reporter_email: string
  reason: string
  status?: ReportStatus
}

export async function listReports(limitCount = 100): Promise<Report[]> {
  const { data, error } = await supabaseClient
    .from('post_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limitCount)
  throwIfPostgrestError(error)

  return (data ?? []) as Report[]
}

export async function createReport(input: CreateReportInput): Promise<void> {
  const payload = {
    ...input,
    status: input.status ?? ('open' satisfies ReportStatus),
  }

  const { error } = await supabaseClient.from('post_reports').insert(payload)
  throwIfPostgrestError(error)
}

export async function reviewReport(
  reportId: string,
  status: ReportStatus,
  reviewedByUserId: string,
): Promise<void> {
  const { error } = await supabaseClient
    .from('post_reports')
    .update({
      status,
      reviewed_by: reviewedByUserId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', reportId)
  throwIfPostgrestError(error)
}
