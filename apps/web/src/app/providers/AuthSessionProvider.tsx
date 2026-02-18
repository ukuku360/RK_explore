import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { isAdminEmail } from '../../lib/guards'
import { ensureSignupEmailAllowed, warmSignupAllowlist } from '../../lib/signupAllowlist'
import { supabaseClient } from '../../services/supabase/client'
import {
  AuthSessionContext,
  type AuthActionResult,
  type AuthSessionContextValue,
  type AuthUser,
  type LoginInput,
  type SignupInput,
} from './auth-session-context'

type AuthSessionProviderProps = {
  children: ReactNode
}

const SESSION_RESTORE_TIMEOUT_MS = 8000

export function AuthSessionProvider({ children }: AuthSessionProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    void warmSignupAllowlist()

    let isMounted = true
    let hasResolvedInitialSession = false
    const sessionRestoreTimeoutId = window.setTimeout(() => {
      if (!isMounted || hasResolvedInitialSession) return

      hasResolvedInitialSession = true
      console.error('[auth] session restore timed out')
      setUser(null)
      setIsLoading(false)
    }, SESSION_RESTORE_TIMEOUT_MS)

    function mapAuthUser(rawUser: {
      id: string
      email?: string | null
      created_at?: string | null
      user_metadata?: { nickname?: string | null } | null
    }): AuthUser | null {
      const email = rawUser.email?.trim().toLowerCase()
      if (!email) return null

      const nickname = rawUser.user_metadata?.nickname?.trim() ?? ''
      const fallbackLabel = email.split('@')[0] || 'Tenant'

      return {
        id: rawUser.id,
        email,
        label: nickname.length > 0 ? nickname : fallbackLabel,
        createdAt: rawUser.created_at ?? new Date().toISOString(),
        isAdmin: isAdminEmail(email),
      }
    }

    async function restoreSession() {
      try {
        const { data, error } = await supabaseClient.auth.getSession()

        if (!isMounted || hasResolvedInitialSession) return

        if (error) {
          console.error('[auth] session restore failed', error)
          setUser(null)
          return
        }

        setUser(data.session?.user ? mapAuthUser(data.session.user) : null)
      } catch (error) {
        if (!isMounted || hasResolvedInitialSession) return
        console.error('[auth] unexpected session restore failure', error)
        setUser(null)
      } finally {
        if (isMounted && !hasResolvedInitialSession) {
          hasResolvedInitialSession = true
          window.clearTimeout(sessionRestoreTimeoutId)
          setIsLoading(false)
        }
      }
    }

    void restoreSession()

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      hasResolvedInitialSession = true
      window.clearTimeout(sessionRestoreTimeoutId)
      setUser(session?.user ? mapAuthUser(session.user) : null)
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      window.clearTimeout(sessionRestoreTimeoutId)
      subscription.unsubscribe()
    }
  }, [])

  const login = useCallback(async (input: LoginInput): Promise<AuthActionResult> => {
    const email = input.email.trim()
    const password = input.password.trim()

    if (!email || !password) {
      return { ok: false, message: 'Please enter email and password.' }
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password })
    if (error) {
      return { ok: false, message: error.message }
    }

    if (!data.user?.email_confirmed_at) {
      await supabaseClient.auth.signOut()
      return { ok: false, message: 'Please verify your email before logging in.' }
    }

    return { ok: true }
  }, [])

  const signup = useCallback(async (input: SignupInput): Promise<AuthActionResult> => {
    const email = input.email.trim()
    const password = input.password.trim()
    const nickname = input.nickname.trim().replace(/\s+/g, ' ').slice(0, 20)

    if (!email || !password) {
      return { ok: false, message: 'Please enter email and password.' }
    }

    if (nickname.length < 2) {
      return { ok: false, message: 'Please choose a nickname (2-20 chars).' }
    }

    const allowlistCheck = await ensureSignupEmailAllowed(email)
    if (!allowlistCheck.ok) {
      return { ok: false, message: allowlistCheck.message }
    }

    const { error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { nickname } },
    })

    if (error) {
      return { ok: false, message: error.message }
    }

    return { ok: true, message: `Check your email for the confirmation link, ${nickname}!` }
  }, [])

  const logout = useCallback(async (): Promise<AuthActionResult> => {
    const { error } = await supabaseClient.auth.signOut()
    if (error) {
      return { ok: false, message: error.message }
    }
    return { ok: true }
  }, [])

  const value = useMemo<AuthSessionContextValue>(() => {
    return {
      user,
      sessionEmail: user?.email ?? null,
      isAdmin: user?.isAdmin ?? false,
      isLoading,
      login,
      signup,
      logout,
    }
  }, [isLoading, user, login, signup, logout])

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>
}
