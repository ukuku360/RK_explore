import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '../../../lib/queryKeys'
import { listReportsByReporter } from '../../../services/reports/reports.service'

export function useMyReportsQuery(reporterUserId: string | null | undefined, enabled = true) {
  const normalizedReporterId = reporterUserId ?? ''

  return useQuery({
    queryKey: queryKeys.reports.byReporterAll(normalizedReporterId),
    queryFn: () => listReportsByReporter(normalizedReporterId, 200),
    enabled: enabled && normalizedReporterId.length > 0,
  })
}
