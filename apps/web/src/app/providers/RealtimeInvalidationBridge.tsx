import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { invalidateForRealtimeTable } from '../../lib/queryInvalidation'
import type { RealtimeTableName } from '../../lib/queryKeys'
import { supabaseClient } from '../../services/supabase/client'
import {
  RealtimeSyncContext,
  type RealtimeSyncStatus,
} from './realtime-sync-context'

const REALTIME_TABLES: readonly RealtimeTableName[] = [
  'posts',
  'votes',
  'rsvps',
  'comments',
  'post_reports',
  'admin_action_logs',
]

type RealtimeSyncProviderProps = {
  children: ReactNode
}

function mapChannelStatus(status: string): RealtimeSyncStatus {
  if (status === 'SUBSCRIBED') return 'live'
  if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') return 'offline'
  return 'connecting'
}

export function RealtimeSyncProvider({ children }: RealtimeSyncProviderProps) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<RealtimeSyncStatus>('connecting')

  useEffect(() => {
    const channel = supabaseClient.channel('rk-explores-react-sync')

    REALTIME_TABLES.forEach((tableName) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        () => {
          void invalidateForRealtimeTable(queryClient, tableName)
        },
      )
    })

    channel.subscribe((nextStatus) => {
      setStatus(mapChannelStatus(nextStatus))
    })

    return () => {
      void supabaseClient.removeChannel(channel)
    }
  }, [queryClient])

  const value = useMemo(() => ({ status }), [status])

  return <RealtimeSyncContext.Provider value={value}>{children}</RealtimeSyncContext.Provider>
}
