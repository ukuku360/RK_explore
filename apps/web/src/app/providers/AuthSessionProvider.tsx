import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { env } from '../../lib/env'
import { isAdminEmail } from '../../lib/guards'
import { supabaseClient } from '../../services/supabase/client'
import { AuthSessionContext, type AuthSessionContextValue } from './auth-session-context'

type AuthSessionProviderProps = {
  children: ReactNode
}

export function AuthSessionProvider({ children }: AuthSessionProviderProps) {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function restoreSession() {
      const { data, error } = await supabaseClient.auth.getSession()

      if (!isMounted) return

      if (error) {
        console.error('[auth] session restore failed', error)
        setSessionEmail(null)
        setIsLoading(false)
        return
      }

      setSessionEmail(data.session?.user.email ?? null)
      setIsLoading(false)
    }

    void restoreSession()

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? null)
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthSessionContextValue>(() => {
    return {
      sessionEmail,
      isAdmin: isAdminEmail(sessionEmail, env.adminEmail),
      isLoading,
    }
  }, [isLoading, sessionEmail])

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>
}
