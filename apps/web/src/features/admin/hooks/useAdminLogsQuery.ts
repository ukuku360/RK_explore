import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '../../../lib/queryKeys'
import { listAdminLogs } from '../../../services/admin/admin.service'

export function useAdminLogsQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.adminLogs.list(),
    queryFn: () => listAdminLogs(100),
    enabled,
  })
}
