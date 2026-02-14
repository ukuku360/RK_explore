import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactElement } from 'react'

import { AppShell } from '../layout/AppShell'
import { useAuthSession } from '../providers/auth-session-context'
import { AuthPage } from '../../features/auth/pages/AuthPage'
import { FeedPage } from '../../features/feed/pages/FeedPage'
import { NotFoundPage } from '../../features/not-found/pages/NotFoundPage'

const AdminPage = lazy(() => import('../../features/admin/pages/AdminPage'))

function RouteLoading({ label }: { label: string }) {
  return (
    <section className="rk-page">
      <h1>{label}</h1>
    </section>
  )
}

function AdminRoute() {
  const { isAdmin, isLoading, user } = useAuthSession()

  if (isLoading) {
    return <RouteLoading label="Checking admin permissions..." />
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return (
    <Suspense fallback={<RouteLoading label="Loading admin tools..." />}>
      <AdminPage />
    </Suspense>
  )
}

function ProtectedRoute({ children }: { children: ReactElement }) {
  const { user, isLoading } = useAuthSession()

  if (isLoading) {
    return <RouteLoading label="Restoring your session..." />
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  return children
}

function AuthRoute() {
  const { user, isLoading } = useAuthSession()

  if (isLoading) {
    return <RouteLoading label="Restoring your session..." />
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return <AuthPage />
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <FeedPage />
            </ProtectedRoute>
          }
        />
        <Route path="/auth" element={<AuthRoute />} />
        <Route path="/admin" element={<AdminRoute />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
