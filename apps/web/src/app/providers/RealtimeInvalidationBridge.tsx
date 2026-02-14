import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { invalidateForRealtimeTable } from '../../lib/queryInvalidation'
import type { RealtimeTableName } from '../../lib/queryKeys'
import { supabaseClient } from '../../services/supabase/client'

const REALTIME_TABLES: readonly RealtimeTableName[] = [
  'posts',
  'votes',
  'rsvps',
  'comments',
  'post_reports',
  'admin_action_logs',
]

export function RealtimeInvalidationBridge() {
  const queryClient = useQueryClient()

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

    channel.subscribe()

    return () => {
      void supabaseClient.removeChannel(channel)
    }
  }, [queryClient])

  return null
}
