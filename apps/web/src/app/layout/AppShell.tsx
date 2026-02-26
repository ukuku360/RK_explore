import { useMemo, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'

import { useAuthSession } from '../providers/auth-session-context'
import { useRealtimeSyncStatus } from '../providers/realtime-sync-context'
import { usePostsWithRelationsQuery } from '../../features/feed/hooks/usePostsWithRelationsQuery'

function navClassName({ isActive }: { isActive: boolean }) {
  return isActive ? 'rk-nav-link rk-nav-link-active' : 'rk-nav-link'
}

function formatJoinedDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatStatusLabel(status: 'connecting' | 'live' | 'offline') {
  if (status === 'live') return 'Live Sync'
  if (status === 'offline') return 'Offline'
  return 'Syncing'
}

export function AppShell() {
  const { isAdmin, user, logout } = useAuthSession()
  const realtimeStatus = useRealtimeSyncStatus()
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  const postsQuery = usePostsWithRelationsQuery({ enabled: Boolean(user) })

  const profileStats = useMemo(() => {
    if (!user || !postsQuery.data) {
      return { ownPosts: 0, votesCast: 0, rsvpsJoined: 0 }
    }

    const ownPosts = postsQuery.data.filter((post) => post.user_id === user.id).length
    const votesCast = postsQuery.data.filter((post) => post.votes.some((vote) => vote.user_id === user.id)).length
    const rsvpsJoined = postsQuery.data.filter((post) =>
      post.rsvps.some((rsvp) => rsvp.user_id === user.id),
    ).length

    return { ownPosts, votesCast, rsvpsJoined }
  }, [postsQuery.data, user])

  async function handleLogout() {
    setIsProfileOpen(false)
    await logout()
  }

  if (!user) {
    return (
      <div className="rk-shell">
        <main className="rk-main">
          <Outlet />
        </main>
      </div>
    )
  }

  return (
    <div className="rk-shell">
      <header className="rk-header">
        <div className="rk-header-inner">
          <a className="rk-brand" href="/" onClick={() => setIsProfileOpen(false)}>
            <img className="rk-brand-logo" src="/brand/rk-logo-colour.svg" alt="RoomingKos" />
            <img className="rk-brand-mark" src="/brand/rk-brandmark-colour.svg" alt="" aria-hidden />
            <span className="rk-brand-explores">Explores</span>
          </a>
          <nav className="rk-nav" aria-label="Primary">
            <NavLink to="/" end className={navClassName}>
              Feed
            </NavLink>
            <NavLink to="/community" className={navClassName}>
              Community
            </NavLink>
            <NavLink to="/marketplace" className={navClassName}>
              Marketplace
            </NavLink>
            <NavLink to="/members" className={navClassName}>
              Members
            </NavLink>
            {isAdmin ? (
              <NavLink to="/admin" className={navClassName}>
                Admin
              </NavLink>
            ) : null}
          </nav>
          <div className="rk-session-group">
            <div className="rk-user-hud">
              <div className="rk-hud-status" title={formatStatusLabel(realtimeStatus)}>
                <span className={`rk-hud-dot rk-hud-dot-${realtimeStatus}`} />
              </div>
              <button
                type="button"
                className="rk-hud-profile"
                onClick={() => setIsProfileOpen((previous) => !previous)}
                title={isProfileOpen ? 'Close Profile' : 'My Profile'}
              >
                <div className="rk-hud-avatar">
                  {user.label.charAt(0).toUpperCase()}
                </div>
                <span className="rk-hud-name">{user.label}</span>
              </button>
              <button
                type="button"
                className="rk-hud-logout"
                onClick={() => void handleLogout()}
                title="Log out"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>
        {isProfileOpen ? (
          <div className="rk-profile-panel">
            <h3>My Profile</h3>
            <p className="rk-profile-subtext">Account details and activity snapshot.</p>
            <div className="rk-profile-grid">
              <div className="rk-profile-item">
                <span className="rk-profile-label">Nickname</span>
                <strong>{user.label}</strong>
              </div>
              <div className="rk-profile-item">
                <span className="rk-profile-label">Email</span>
                <strong>{user.email}</strong>
              </div>
              <div className="rk-profile-item">
                <span className="rk-profile-label">Joined</span>
                <strong>{formatJoinedDate(user.createdAt)}</strong>
              </div>
              <div className="rk-profile-item">
                <span className="rk-profile-label">Trips posted</span>
                <strong>{profileStats.ownPosts}</strong>
              </div>
              <div className="rk-profile-item">
                <span className="rk-profile-label">Votes cast</span>
                <strong>{profileStats.votesCast}</strong>
              </div>
              <div className="rk-profile-item">
                <span className="rk-profile-label">RSVPs joined</span>
                <strong>{profileStats.rsvpsJoined}</strong>
              </div>
            </div>
            <div className="rk-profile-panel-actions">
              <Link
                to="/profile"
                className="rk-button rk-button-secondary rk-button-small"
                onClick={() => setIsProfileOpen(false)}
              >
                View Full Profile
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      <main className="rk-main">
        <Outlet />
      </main>
    </div>
  )
}
