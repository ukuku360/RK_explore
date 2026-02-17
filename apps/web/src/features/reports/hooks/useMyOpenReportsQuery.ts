import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '../../../lib/queryKeys'
import { listOpenReportsByReporter } from '../../../services/reports/reports.service'

export function useMyOpenReportsQuery(reporterUserId: string | null | undefined, enabled = true) {
  const normalizedReporterId = reporterUserId ?? ''

  return useQuery({
    queryKey: queryKeys.reports.byReporter(normalizedReporterId),
    queryFn: () => listOpenReportsByReporter(normalizedReporterId, 200),
    enabled: enabled && normalizedReporterId.length > 0,
  })
}
