import { useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuthSession } from '../../../app/providers/auth-session-context'

export function AuthPage() {
  const navigate = useNavigate()
  const { login, signup } = useAuthSession()

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
    navigate('/', { replace: true })
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
    void handleLogin()
  }

  return (
    <section className="rk-page rk-auth-page">
      <h1>RoomingKos Explores</h1>
      <p>Sign in with your email to post, vote, RSVP, and join conversations.</p>

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

        <label className="rk-auth-label">
          Nickname (sign up only)
          <input
            className="rk-auth-input"
            type="text"
            autoComplete="nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            disabled={isSubmitting}
          />
        </label>

        <label className="rk-auth-label">
          Password
          <input
            className="rk-auth-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={handlePasswordKeyDown}
            disabled={isSubmitting}
          />
        </label>
      </div>

      <div className="rk-auth-actions">
        <button type="button" className="rk-button" onClick={() => void handleLogin()} disabled={isSubmitting}>
          Log In
        </button>
        <button
          type="button"
          className="rk-button rk-button-secondary"
          onClick={() => void handleSignup()}
          disabled={isSubmitting}
        >
          Sign Up
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
