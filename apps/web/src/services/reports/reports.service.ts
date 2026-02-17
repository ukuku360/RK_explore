import { supabaseClient } from '../supabase/client'
import { throwIfPostgrestError } from '../supabase/errors'
import type { Report, ReportStatus, ReportTargetType } from '../../types/domain'

type CreateReportInput = {
  target_type: ReportTargetType
  target_id: string
  reporter_user_id: string
  reporter_email: string
  reporter_nickname: string
  reason: string
  status?: ReportStatus
}

type TargetFilterInput = {
  target_type: ReportTargetType
  target_id: string
}

type ClearOpenReportsByReporterTargetInput = TargetFilterInput & {
  reporter_user_id: string
}

type ReviewReportsByTargetInput = TargetFilterInput & {
  status: ReportStatus
  reviewed_by_user_id: string
}

function buildTargetColumns(targetType: ReportTargetType, targetId: string): {
  target_type: ReportTargetType
  post_id: string | null
  community_post_id: string | null
} {
  if (targetType === 'community') {
    return {
      target_type: 'community',
      post_id: null,
      community_post_id: targetId,
    }
  }

  return {
    target_type: 'feed',
    post_id: targetId,
    community_post_id: null,
  }
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

export async function listOpenReportsByReporter(reporterUserId: string, limitCount = 200): Promise<Report[]> {
  const { data, error } = await supabaseClient
    .from('post_reports')
    .select('*')
    .eq('reporter_user_id', reporterUserId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(limitCount)
  throwIfPostgrestError(error)

  return (data ?? []) as Report[]
}

export async function createReport(input: CreateReportInput): Promise<void> {
  const payload = {
    ...buildTargetColumns(input.target_type, input.target_id),
    reporter_user_id: input.reporter_user_id,
    reporter_email: input.reporter_email,
    reporter_nickname: input.reporter_nickname,
    reason: input.reason,
    status: input.status ?? ('open' satisfies ReportStatus),
  }

  const { error } = await supabaseClient.from('post_reports').insert(payload)
  throwIfPostgrestError(error)
}

export async function clearOpenReportsByReporterTarget(input: ClearOpenReportsByReporterTargetInput): Promise<void> {
  const reviewFilters = {
    reporter_user_id: input.reporter_user_id,
    status: 'open',
    target_type: input.target_type,
  } as const

  const mutation =
    input.target_type === 'community'
      ? supabaseClient
          .from('post_reports')
          .delete()
          .match(reviewFilters)
          .eq('community_post_id', input.target_id)
          .is('post_id', null)
      : supabaseClient
          .from('post_reports')
          .delete()
          .match(reviewFilters)
          .eq('post_id', input.target_id)
          .is('community_post_id', null)

  const { error } = await mutation
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

export async function reviewReportsByTarget(input: ReviewReportsByTargetInput): Promise<void> {
  const payload = {
    status: input.status,
    reviewed_by: input.reviewed_by_user_id,
    reviewed_at: new Date().toISOString(),
  }

  const reviewFilters = {
    status: 'open',
    target_type: input.target_type,
  } as const

  const mutation =
    input.target_type === 'community'
      ? supabaseClient
          .from('post_reports')
          .update(payload)
          .match(reviewFilters)
          .eq('community_post_id', input.target_id)
          .is('post_id', null)
      : supabaseClient
          .from('post_reports')
          .update(payload)
          .match(reviewFilters)
          .eq('post_id', input.target_id)
          .is('community_post_id', null)

  const { error } = await mutation
  throwIfPostgrestError(error)
}
