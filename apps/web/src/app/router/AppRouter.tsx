import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactElement } from 'react'

import { AppShell } from '../layout/AppShell'
import { useAuthSession } from '../providers/auth-session-context'
import { AuthPage } from '../../features/auth/pages/AuthPage'
import { FeedPage } from '../../features/feed/pages/FeedPage'
import { MembersPage } from '../../features/members/pages/MembersPage'
import { NotFoundPage } from '../../features/not-found/pages/NotFoundPage'
import { ProfilePage } from '../../features/profile/pages/ProfilePage'

const AdminPage = lazy(() => import('../../features/admin/pages/AdminPage'))
const CommunityPage = lazy(() => import('../../features/community/pages/CommunityPage').then(module => ({ default: module.CommunityPage })))

function resolvePostAuthRedirect(state: unknown): string {
  if (!state || typeof state !== 'object') return '/'

  const redirectTo = (state as { redirectTo?: unknown }).redirectTo
  if (typeof redirectTo !== 'string') return '/'
  if (!redirectTo.startsWith('/')) return '/'
  if (redirectTo.startsWith('//')) return '/'
  if (redirectTo.startsWith('/auth')) return '/'

  return redirectTo
}

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
    return <Navigate to="/" replace state={{ accessDenied: 'admin_workspace' }} />
  }

  return (
    <Suspense fallback={<RouteLoading label="Loading admin tools..." />}>
      <AdminPage />
    </Suspense>
  )
}

function ProtectedRoute({ children }: { children: ReactElement }) {
  const { user, isLoading } = useAuthSession()
  const location = useLocation()

  if (isLoading) {
    return <RouteLoading label="Restoring your session..." />
  }

  if (!user) {
    const redirectTo = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to="/auth" replace state={{ redirectTo }} />
  }

  return children
}

function AuthRoute() {
  const { user, isLoading } = useAuthSession()
  const location = useLocation()

  if (isLoading) {
    return <RouteLoading label="Restoring your session..." />
  }

  if (user) {
    return <Navigate to={resolvePostAuthRedirect(location.state)} replace />
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
        <Route 
          path="/community" 
          element={
            <ProtectedRoute>
              <Suspense fallback={<RouteLoading label="Loading community..." />}>
                <CommunityPage />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        <Route path="/admin" element={<AdminRoute />} />
        <Route
          path="/members"
          element={
            <ProtectedRoute>
              <MembersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/:userId"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
