import { createContext, useContext } from 'react'

export type AuthSessionContextValue = {
  sessionEmail: string | null
  isAdmin: boolean
  isLoading: boolean
}

export const AuthSessionContext = createContext<AuthSessionContextValue | undefined>(undefined)

export function useAuthSession() {
  const value = useContext(AuthSessionContext)
  if (!value) {
    throw new Error('useAuthSession must be used inside AuthSessionProvider')
  }
  return value
}
