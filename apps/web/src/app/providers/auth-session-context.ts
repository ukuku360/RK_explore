import { createContext, useContext } from 'react'

export type AuthUser = {
  id: string
  email: string
  label: string
  createdAt: string
  isAdmin: boolean
}

export type LoginInput = {
  email: string
  password: string
}

export type SignupInput = {
  email: string
  password: string
  nickname: string
}

export type AuthActionResult = {
  ok: boolean
  message?: string
}

export type AuthSessionContextValue = {
  user: AuthUser | null
  sessionEmail: string | null
  isAdmin: boolean
  isLoading: boolean
  login: (input: LoginInput) => Promise<AuthActionResult>
  signup: (input: SignupInput) => Promise<AuthActionResult>
  logout: () => Promise<AuthActionResult>
  updateNickname: (nickname: string) => Promise<AuthActionResult>
}

export const AuthSessionContext = createContext<AuthSessionContextValue | undefined>(undefined)

export function useAuthSession() {
  const value = useContext(AuthSessionContext)
  if (!value) {
    throw new Error('useAuthSession must be used inside AuthSessionProvider')
  }
  return value
}
