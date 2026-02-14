import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

import { AuthSessionProvider } from './AuthSessionProvider'
import { queryClient } from './query-client'
import { RealtimeSyncProvider } from './RealtimeInvalidationBridge'

type AppProvidersProps = {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeSyncProvider>
        <AuthSessionProvider>
          <BrowserRouter>{children}</BrowserRouter>
        </AuthSessionProvider>
      </RealtimeSyncProvider>
    </QueryClientProvider>
  )
}
