import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { useAuthSession } from '../../../app/providers/auth-session-context'
import { queryKeys } from '../../../lib/queryKeys'
import { listProfileDirectoryUsers } from '../../../services/profile/profile-directory.service'

const DAY_IN_MS = 24 * 60 * 60 * 1000

function formatLastActive(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getLastActiveDaysAgo(value: string): number | null {
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return null

  const deltaMs = Date.now() - timestamp
  if (deltaMs <= 0) return 0
  return Math.floor(deltaMs / DAY_IN_MS)
}

function getActivityBadgeLabel(value: string): string {
  const daysAgo = getLastActiveDaysAgo(value)
  if (daysAgo === null) return 'Unknown'
  if (daysAgo === 0) return 'Active today'
  if (daysAgo === 1) return 'Active yesterday'
  if (daysAgo < 7) return `Active ${daysAgo}d ago`
  if (daysAgo < 30) return `Active ${Math.floor(daysAgo / 7)}w ago`
  return `Active ${Math.floor(daysAgo / 30)}mo ago`
}

function getNicknameInitials(value: string): string {
  const cleaned = value.trim()
  if (!cleaned) return '?'

  const words = cleaned.split(/\s+/).filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase()
}

export function MembersPage() {
  const { user } = useAuthSession()

  const membersQuery = useQuery({
    queryKey: [...queryKeys.profile.all, 'directory'],
    queryFn: () => listProfileDirectoryUsers(),
    enabled: Boolean(user),
  })

  const members = useMemo(() => {
    if (!membersQuery.data || !user) return []
    return membersQuery.data.filter((member) => member.userId !== user.id)
  }, [membersQuery.data, user])

  const memberStats = useMemo(() => {
    let activeToday = 0
    let activeThisWeek = 0

    for (const member of members) {
      const daysAgo = getLastActiveDaysAgo(member.lastActiveAt)
      if (daysAgo === null) continue
      if (daysAgo <= 0) activeToday += 1
      if (daysAgo <= 7) activeThisWeek += 1
    }

    return {
      total: members.length,
      activeToday,
      activeThisWeek,
    }
  }, [members])

  return (
    <section className="rk-page rk-members-page">
      <div className="rk-members-hero">
        <div className="rk-members-hero-copy">
          <p className="rk-members-kicker">Community directory</p>
          <h1>Members</h1>
          <p className="rk-page-subtitle">Browse active members, open profiles, and connect faster.</p>
        </div>
        <div className="rk-members-stats" aria-label="Members summary">
          <div className="rk-members-stat-card">
            <span>Total</span>
            <strong>{memberStats.total}</strong>
          </div>
          <div className="rk-members-stat-card">
            <span>Today</span>
            <strong>{memberStats.activeToday}</strong>
          </div>
          <div className="rk-members-stat-card">
            <span>7 Days</span>
            <strong>{memberStats.activeThisWeek}</strong>
          </div>
        </div>
      </div>

      {membersQuery.isLoading ? (
        <p className="rk-members-state rk-members-state-loading">Loading members...</p>
      ) : null}

      {membersQuery.error instanceof Error ? (
        <p className="rk-members-state rk-members-state-error">{membersQuery.error.message}</p>
      ) : null}

      {!membersQuery.isLoading && members.length === 0 ? (
        <div className="rk-members-empty">
          <strong>No members to show yet.</strong>
          <p>Once users start posting or commenting, they will appear here.</p>
        </div>
      ) : null}

      {members.length > 0 ? (
        <ul className="rk-members-grid" aria-label="Members list">
          {members.map((member) => (
            <li key={member.userId} className="rk-members-grid-item">
              <Link className="rk-members-card" to={`/profile/${member.userId}`}>
                <div className="rk-members-card-head">
                  <div className="rk-members-avatar" aria-hidden>
                    {member.avatarUrl ? (
                      <img src={member.avatarUrl} alt="" className="rk-members-avatar-image" loading="lazy" />
                    ) : (
                      getNicknameInitials(member.nickname)
                    )}
                  </div>
                  <div className="rk-members-info">
                    <strong>{member.nickname}</strong>
                    <span>Last active {formatLastActive(member.lastActiveAt)}</span>
                  </div>
                  <span className="rk-members-activity-pill">{getActivityBadgeLabel(member.lastActiveAt)}</span>
                </div>
                <div className="rk-members-card-foot">
                  <span>Open profile</span>
                  <span className="rk-members-arrow" aria-hidden>
                    {'->'}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
