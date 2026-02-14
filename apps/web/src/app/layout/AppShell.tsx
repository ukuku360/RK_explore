import { NavLink, Outlet } from 'react-router-dom'

import { useAuthSession } from '../providers/auth-session-context'

function navClassName({ isActive }: { isActive: boolean }) {
  return isActive ? 'rk-nav-link rk-nav-link-active' : 'rk-nav-link'
}

export function AppShell() {
  const { isAdmin, isLoading, sessionEmail } = useAuthSession()

  return (
    <div className="rk-shell">
      <header className="rk-header">
        <div className="rk-header-inner">
          <div className="rk-brand">
            <span className="rk-brand-rooming">RoomingKos</span>
            <span className="rk-brand-explores">Explores</span>
          </div>
          <nav className="rk-nav" aria-label="Primary">
            <NavLink to="/" end className={navClassName}>
              Feed
            </NavLink>
            <NavLink to="/auth" className={navClassName}>
              Auth
            </NavLink>
            {isAdmin ? (
              <NavLink to="/admin" className={navClassName}>
                Admin
              </NavLink>
            ) : null}
          </nav>
          <div className="rk-session">
            {isLoading ? 'Session: checking' : `Session: ${sessionEmail ?? 'guest'}`}
          </div>
        </div>
      </header>

      <main className="rk-main">
        <Outlet />
      </main>
    </div>
  )
}
