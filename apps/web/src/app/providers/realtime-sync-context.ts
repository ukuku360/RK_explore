import { createContext, useContext } from 'react'

export type RealtimeSyncStatus = 'connecting' | 'live' | 'offline'

type RealtimeSyncContextValue = {
  status: RealtimeSyncStatus
}

export const RealtimeSyncContext = createContext<RealtimeSyncContextValue | undefined>(undefined)

export function useRealtimeSyncStatus() {
  const value = useContext(RealtimeSyncContext)
  if (!value) {
    throw new Error('useRealtimeSyncStatus must be used inside RealtimeSyncProvider')
  }
  return value.status
}
