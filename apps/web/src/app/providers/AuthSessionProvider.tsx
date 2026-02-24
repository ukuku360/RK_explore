import { useEffect, useState, type ReactNode } from 'react'

import { ensureSignupEmailAllowed, warmSignupAllowlist } from '../../lib/signupAllowlist'
import { isCurrentUserAdmin } from '../../services/auth/user-roles.service'
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

type RawAuthUser = {
  id: string
  email?: string | null
  created_at?: string | null
  user_metadata?: { nickname?: string | null } | null
}

function normalizeNickname(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 20)
}

function mapAuthUser(rawUser: RawAuthUser, isAdmin: boolean): AuthUser | null {
  const email = rawUser.email?.trim().toLowerCase()
  if (!email) return null

  const nickname = rawUser.user_metadata?.nickname?.trim() ?? ''
  const fallbackLabel = email.split('@')[0] || 'Tenant'

  return {
    id: rawUser.id,
    email,
    label: nickname.length > 0 ? nickname : fallbackLabel,
    createdAt: rawUser.created_at ?? new Date().toISOString(),
    isAdmin,
  }
}

async function mapSessionUser(rawUser: RawAuthUser | null | undefined): Promise<AuthUser | null> {
  if (!rawUser) return null

  const fallbackUser = mapAuthUser(rawUser, false)
  if (!fallbackUser) return null

  try {
    const isAdmin = await isCurrentUserAdmin(rawUser.id)
    return {
      ...fallbackUser,
      isAdmin,
    }
  } catch (error) {
    console.error('[auth] failed to resolve user role', error)
    return fallbackUser
  }
}

export function AuthSessionProvider({ children }: AuthSessionProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    void warmSignupAllowlist()

    let isMounted = true
    let hasResolvedInitialSession = false
    let latestSessionResolveId = 0
    const sessionRestoreTimeoutId = window.setTimeout(() => {
      if (!isMounted || hasResolvedInitialSession) return

      hasResolvedInitialSession = true
      console.error('[auth] session restore timed out')
      setUser(null)
      setIsLoading(false)
    }, SESSION_RESTORE_TIMEOUT_MS)

    async function resolveAndSetUser(rawUser: RawAuthUser | null | undefined): Promise<void> {
      const resolveId = ++latestSessionResolveId
      const mappedUser = await mapSessionUser(rawUser)

      if (!isMounted || resolveId !== latestSessionResolveId) return
      setUser(mappedUser)
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

        await resolveAndSetUser((data.session?.user as RawAuthUser | null) ?? null)
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
      void resolveAndSetUser((session?.user as RawAuthUser | null) ?? null).finally(() => {
        if (!isMounted) return
        setIsLoading(false)
      })
    })

    return () => {
      isMounted = false
      window.clearTimeout(sessionRestoreTimeoutId)
      subscription.unsubscribe()
    }
  }, [])

  async function login(input: LoginInput): Promise<AuthActionResult> {
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
  }

  async function signup(input: SignupInput): Promise<AuthActionResult> {
    const email = input.email.trim()
    const password = input.password.trim()
    const nickname = normalizeNickname(input.nickname)

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
  }

  async function updateNickname(nextNickname: string): Promise<AuthActionResult> {
    if (!user) {
      return { ok: false, message: 'Please log in first.' }
    }

    const nickname = normalizeNickname(nextNickname)
    if (nickname.length < 2) {
      return { ok: false, message: 'Please choose a nickname (2-20 chars).' }
    }

    if (nickname === user.label) {
      return { ok: true }
    }

    const { data, error } = await supabaseClient.auth.updateUser({
      data: { nickname },
    })
    if (error) {
      return { ok: false, message: error.message }
    }

    const mappedUser = await mapSessionUser((data.user as RawAuthUser | null) ?? null)
    if (mappedUser) {
      setUser(mappedUser)
    } else {
      setUser((current) => (current ? { ...current, label: nickname } : current))
    }

    return { ok: true }
  }

  async function logout(): Promise<AuthActionResult> {
    const { error } = await supabaseClient.auth.signOut()
    if (error) {
      return { ok: false, message: error.message }
    }
    return { ok: true }
  }

  const value: AuthSessionContextValue = {
    user,
    sessionEmail: user?.email ?? null,
    isAdmin: user?.isAdmin ?? false,
    isLoading,
    login,
    signup,
    logout,
    updateNickname,
  }

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>
}
