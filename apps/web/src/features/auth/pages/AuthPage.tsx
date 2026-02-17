import { useState, type KeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useAuthSession } from '../../../app/providers/auth-session-context'

type AuthMode = 'login' | 'signup'

function resolvePostAuthRedirect(state: unknown): string {
  if (!state || typeof state !== 'object') return '/'

  const redirectTo = (state as { redirectTo?: unknown }).redirectTo
  if (typeof redirectTo !== 'string') return '/'
  if (!redirectTo.startsWith('/')) return '/'
  if (redirectTo.startsWith('//')) return '/'
  if (redirectTo.startsWith('/auth')) return '/'

  return redirectTo
}

export function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, signup } = useAuthSession()

  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState<'idle' | 'error' | 'success'>('idle')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleLogin() {
    setIsSubmitting(true)
    const result = await login({ email, password })
    setIsSubmitting(false)

    if (!result.ok) {
      setStatusType('error')
      setStatusMessage(result.message ?? 'Unable to log in right now.')
      return
    }

    setStatusType('success')
    setStatusMessage('Welcome back!')
    navigate(resolvePostAuthRedirect(location.state), { replace: true })
  }

  async function handleSignup() {
    setIsSubmitting(true)
    const result = await signup({ email, password, nickname })
    setIsSubmitting(false)

    if (!result.ok) {
      setStatusType('error')
      setStatusMessage(result.message ?? 'Unable to sign up right now.')
      return
    }

    setStatusType('success')
    setStatusMessage(result.message ?? 'Signup successful. Check your inbox.')
  }

  function handlePasswordKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()

    if (mode === 'signup') {
      void handleSignup()
      return
    }

    void handleLogin()
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode)
    setStatusType('idle')
    setStatusMessage('')
  }

  return (
    <section className="rk-page rk-auth-page">
      <h1>RoomingKos Explores</h1>
      <p>
        {mode === 'login'
          ? 'Sign in with your email to post, vote, RSVP, and join conversations.'
          : 'Create your account to start sharing and joining trip ideas.'}
      </p>

      <div className="rk-auth-actions">
        <button
          type="button"
          className={`rk-chip ${mode === 'login' ? 'rk-chip-active' : ''}`}
          onClick={() => switchMode('login')}
          disabled={isSubmitting}
        >
          Log in
        </button>
        <button
          type="button"
          className={`rk-chip ${mode === 'signup' ? 'rk-chip-active' : ''}`}
          onClick={() => switchMode('signup')}
          disabled={isSubmitting}
        >
          Sign up
        </button>
      </div>

      <div className="rk-auth-fields">
        <label className="rk-auth-label">
          Email
          <input
            className="rk-auth-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isSubmitting}
          />
        </label>

        {mode === 'signup' ? (
          <label className="rk-auth-label">
            Nickname
            <input
              className="rk-auth-input"
              type="text"
              autoComplete="nickname"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              disabled={isSubmitting}
            />
          </label>
        ) : null}

        <label className="rk-auth-label">
          Password
          <input
            className="rk-auth-input"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={handlePasswordKeyDown}
            disabled={isSubmitting}
          />
        </label>
      </div>

      <div className="rk-auth-actions">
        <button
          type="button"
          className="rk-button"
          onClick={() => void (mode === 'signup' ? handleSignup() : handleLogin())}
          disabled={isSubmitting}
        >
          {mode === 'signup' ? 'Create account' : 'Log in'}
        </button>
        <button
          type="button"
          className="rk-button rk-button-secondary"
          onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}
          disabled={isSubmitting}
        >
          {mode === 'signup' ? 'Use login instead' : 'Need an account?'}
        </button>
      </div>

      {statusMessage ? (
        <p className={statusType === 'error' ? 'rk-auth-message rk-auth-error' : 'rk-auth-message rk-auth-success'}>
          {statusMessage}
        </p>
      ) : null}
    </section>
  )
}
