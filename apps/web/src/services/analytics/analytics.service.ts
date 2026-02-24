import { supabaseClient } from '../supabase/client'
import { throwIfPostgrestError } from '../supabase/errors'
import type { AnalyticsEvent, AnalyticsProperties, AnalyticsRole } from '../../types/domain'

type CreateAnalyticsEventInput = {
  event_name: string
  user_id: string
  role: AnalyticsRole
  post_id?: string | null
  surface: string
  properties?: AnalyticsProperties
}

type ListAnalyticsEventsInput = {
  fromIso: string
  toIso?: string
  limit?: number
  eventNames?: string[]
}

export async function createAnalyticsEvent(input: CreateAnalyticsEventInput): Promise<void> {
  const payload = {
    event_name: input.event_name,
    user_id: input.user_id,
    role: input.role,
    post_id: input.post_id ?? null,
    surface: input.surface,
    properties: input.properties ?? {},
  }

  const { error } = await supabaseClient.from('analytics_events').insert(payload)
  throwIfPostgrestError(error)
}

export async function listAnalyticsEvents(input: ListAnalyticsEventsInput): Promise<AnalyticsEvent[]> {
  const toIso = input.toIso ?? new Date().toISOString()

  let query = supabaseClient
    .from('analytics_events')
    .select('*')
    .gte('created_at', input.fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 5000)

  if (input.eventNames && input.eventNames.length > 0) {
    query = query.in('event_name', input.eventNames)
  }

  const { data, error } = await query
  throwIfPostgrestError(error)

  return (data ?? []) as AnalyticsEvent[]
}
