import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { useAuthSession } from '../../../app/providers/auth-session-context'
import { queryKeys } from '../../../lib/queryKeys'
import { listProfileDirectoryUsers } from '../../../services/profile/profile-directory.service'

function formatLastActive(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
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

  return (
    <section className="rk-page rk-members-page">
      <h1>Members</h1>
      <p className="rk-page-subtitle">Browse other community members and view their profiles.</p>

      {membersQuery.isLoading ? (
        <p className="rk-profile-empty">Loading members...</p>
      ) : null}

      {membersQuery.error instanceof Error ? (
        <p className="rk-profile-error">{membersQuery.error.message}</p>
      ) : null}

      {!membersQuery.isLoading && members.length === 0 ? (
        <div className="rk-empty-state">
          <p>No members to show yet.</p>
          <p className="rk-page-subtitle">When users create activity, they will appear here.</p>
        </div>
      ) : null}

      {members.length > 0 ? (
        <ul className="rk-members-list" aria-label="Members list">
          {members.map((member) => (
            <li key={member.userId} className="rk-members-list-item">
              <Link className="rk-members-card" to={`/profile/${member.userId}`}>
                <div className="rk-members-avatar" aria-hidden>
                  {member.avatarUrl ? (
                    <img src={member.avatarUrl} alt="" className="rk-members-avatar-image" />
                  ) : (
                    member.nickname.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="rk-members-info">
                  <strong>{member.nickname}</strong>
                  <span>Last active {formatLastActive(member.lastActiveAt)}</span>
                </div>
                <span className="rk-members-arrow" aria-hidden>
                  {'->'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
