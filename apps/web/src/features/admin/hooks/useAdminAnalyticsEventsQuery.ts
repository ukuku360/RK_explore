import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '../../../lib/queryKeys'
import { listAnalyticsEvents } from '../../../services/analytics/analytics.service'
import { ADMIN_METRIC_EVENT_NAMES } from '../lib/metrics'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

export function useAdminAnalyticsEventsQuery(enabled: boolean, windowDays: number) {
  return useQuery({
    queryKey: queryKeys.analytics.events(windowDays),
    queryFn: () => {
      const fromIso = new Date(Date.now() - windowDays * ONE_DAY_MS).toISOString()
      return listAnalyticsEvents({
        fromIso,
        limit: 10000,
        eventNames: [...ADMIN_METRIC_EVENT_NAMES],
      })
    },
    enabled,
    staleTime: 30 * 1000,
  })
}
