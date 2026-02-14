import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '../../../lib/queryKeys'
import { listReports } from '../../../services/reports/reports.service'

export function useAdminReportsQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.reports.list(),
    queryFn: () => listReports(100),
    enabled,
  })
}
