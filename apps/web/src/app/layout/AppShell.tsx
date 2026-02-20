import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'

import { useAuthSession } from '../providers/auth-session-context'
import { useRealtimeSyncStatus } from '../providers/realtime-sync-context'
import { formatTimeAgo } from '../../lib/formatters'
import { usePostsWithRelationsQuery } from '../../features/feed/hooks/usePostsWithRelationsQuery'
import { useMyReportsQuery } from '../../features/reports/hooks/useMyReportsQuery'
import {
  buildNotifications,
  NOTIFICATION_RETENTION_DAYS,
  type NotificationItem,
  type NotificationType,
} from '../../features/notifications/lib/notifications'

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

function getNotificationTypeLabel(type: NotificationType): string {
  if (type === 'comment') return 'Comment'
  if (type === 'mention') return 'Mention'
  if (type === 'report_result') return 'Report'
  return 'Meetup'
}

const MAX_NOTIFICATIONS = 40

export function AppShell() {
  const { isAdmin, user, logout } = useAuthSession()
  const realtimeStatus = useRealtimeSyncStatus()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [readNotificationIds, setReadNotificationIds] = useState<Record<string, true>>({})

  const postsQuery = usePostsWithRelationsQuery({ enabled: Boolean(user) })
  const reportsQuery = useMyReportsQuery(user?.id, Boolean(user))

  const notifications = useMemo(() => {
    if (!user) return []

    return buildNotifications({
      posts: postsQuery.data ?? [],
      reports: reportsQuery.data ?? [],
      userId: user.id,
      nickname: user.label,
    }).slice(0, MAX_NOTIFICATIONS)
  }, [postsQuery.data, reportsQuery.data, user])

  const unreadCount = useMemo(
    () => notifications.filter((item) => !readNotificationIds[item.id]).length,
    [notifications, readNotificationIds],
  )

  useEffect(() => {
    setReadNotificationIds((previous) => {
      const liveIds = new Set(notifications.map((item) => item.id))
      const next: Record<string, true> = {}

      for (const id of Object.keys(previous)) {
        if (liveIds.has(id)) {
          next[id] = true
        }
      }

      return next
    })
  }, [notifications])

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

  function handleMarkAllNotificationsAsRead() {
    setReadNotificationIds(() => {
      const next: Record<string, true> = {}
      for (const item of notifications) {
        next[item.id] = true
      }
      return next
    })
  }

  function handleOpenNotifications() {
    setIsProfileOpen(false)
    setIsNotificationOpen((previous) => {
      const next = !previous
      if (next) {
        handleMarkAllNotificationsAsRead()
      }
      return next
    })
  }

  async function handleLogout() {
    setIsProfileOpen(false)
    setIsNotificationOpen(false)
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
          <Link to="/" className="rk-brand">
            <img className="rk-brand-logo" src="/brand/rk-logo-colour.svg" alt="RoomingKos" />
            <img className="rk-brand-mark" src="/brand/rk-brandmark-colour.svg" alt="" aria-hidden />
          </Link>
          <nav className="rk-nav" aria-label="Primary">
            <NavLink to="/" end className={navClassName}>
              Explore
            </NavLink>
            <NavLink to="/community" className={navClassName}>
              Community
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
            <div className="rk-connection">
              <span className={`rk-connection-dot rk-connection-${realtimeStatus}`} />
              <span>{formatStatusLabel(realtimeStatus)}</span>
            </div>
            <button
              type="button"
              className="rk-icon-button"
              onClick={handleOpenNotifications}
              aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
            >
              <span aria-hidden>🔔</span>
              {unreadCount > 0 ? <span className="rk-notification-badge">{unreadCount}</span> : null}
            </button>
            <button
              type="button"
              className="rk-button rk-button-secondary rk-button-small"
              onClick={() => {
                setIsNotificationOpen(false)
                setIsProfileOpen((previous) => !previous)
              }}
            >
              {isProfileOpen ? 'Close Profile' : 'My Profile'}
            </button>
            <button type="button" className="rk-button rk-button-small" onClick={() => void handleLogout()}>
              Log out
            </button>
          </div>
        </div>
        {isNotificationOpen ? (
          <div className="rk-notification-panel">
            <div className="rk-notification-panel-header">
              <div>
                <h3>Notifications</h3>
                <p>Personalized updates from the last {NOTIFICATION_RETENTION_DAYS} days.</p>
              </div>
              <button
                type="button"
                className="rk-button rk-button-secondary rk-button-small"
                onClick={handleMarkAllNotificationsAsRead}
                disabled={notifications.length === 0}
              >
                Mark all read
              </button>
            </div>
            {notifications.length === 0 ? (
              <p className="rk-feed-note">No notifications yet.</p>
            ) : (
              <ul className="rk-notification-list">
                {notifications.map((notification: NotificationItem) => (
                  <li key={notification.id} className="rk-notification-item">
                    <div className="rk-notification-item-meta">
                      <span className="rk-notification-chip">{getNotificationTypeLabel(notification.type)}</span>
                      <span>{formatTimeAgo(notification.createdAt)}</span>
                    </div>
                    <strong>{notification.title}</strong>
                    <p>{notification.message}</p>
                    <Link to={notification.targetPath} onClick={() => setIsNotificationOpen(false)}>
                      View
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
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
