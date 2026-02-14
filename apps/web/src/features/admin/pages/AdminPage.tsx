import { useMemo } from 'react'

import { useAuthSession } from '../../../app/providers/auth-session-context'
import { formatDateTime } from '../../../lib/formatters'
import { usePostsWithRelationsQuery } from '../../feed/hooks/usePostsWithRelationsQuery'
import { useAdminLogsQuery } from '../hooks/useAdminLogsQuery'
import { useAdminReportsQuery } from '../hooks/useAdminReportsQuery'

function getActionLabel(action: string): string {
  if (action === 'hide') return 'Post Hidden'
  if (action === 'unhide') return 'Post Unhidden'
  if (action === 'delete') return 'Post Deleted'
  if (action === 'dismiss_report') return 'Report Dismissed'
  return 'Admin Action'
}

export default function AdminPage() {
  const { user, isAdmin } = useAuthSession()
  const postsQuery = usePostsWithRelationsQuery({ enabled: isAdmin })
  const reportsQuery = useAdminReportsQuery(isAdmin)
  const logsQuery = useAdminLogsQuery(isAdmin)

  const openReports = useMemo(() => {
    return (reportsQuery.data ?? []).filter((report) => report.status === 'open')
  }, [reportsQuery.data])

  const hiddenPosts = useMemo(() => {
    return (postsQuery.data ?? []).filter((post) => post.is_hidden)
  }, [postsQuery.data])

  const postTitleById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const post of postsQuery.data ?? []) {
      map[post.id] = post.location
    }
    return map
  }, [postsQuery.data])

  async function handleRefresh() {
    await Promise.all([postsQuery.refetch(), reportsQuery.refetch(), logsQuery.refetch()])
  }

  if (!user || !isAdmin) {
    return (
      <section className="rk-page">
        <h1>Admin Workspace</h1>
        <p>Admin mode requires `swanston@roomingkos.com`.</p>
      </section>
    )
  }

  return (
    <section className="rk-page rk-admin-page">
      <h1>Admin Workspace</h1>
      <p>Review reports, hide posts, and keep a reasoned moderation trail.</p>

      <div className="rk-admin-top">
        <div className="rk-admin-stats">
          <div className="rk-admin-stat">
            <span>Open reports</span>
            <strong>{openReports.length}</strong>
          </div>
          <div className="rk-admin-stat">
            <span>Hidden posts</span>
            <strong>{hiddenPosts.length}</strong>
          </div>
        </div>
        <button
          type="button"
          className="rk-button rk-button-secondary rk-button-small"
          onClick={() => void handleRefresh()}
        >
          Refresh
        </button>
      </div>

      <div className="rk-admin-columns">
        <section className="rk-panel">
          <h2>Report Queue</h2>
          {reportsQuery.isLoading ? <p className="rk-feed-note">Loading report queue...</p> : null}
          {openReports.length === 0 && !reportsQuery.isLoading ? (
            <p className="rk-feed-note">No open reports.</p>
          ) : null}
          <div className="rk-admin-list">
            {openReports.map((report) => (
              <article key={report.id} className="rk-admin-item">
                <strong>🚩 {postTitleById[report.post_id] ?? 'Deleted post'}</strong>
                <span>
                  {report.reporter_email} • {formatDateTime(report.created_at)}
                </span>
                <p>Reason: {report.reason || '-'}</p>
                <div className="rk-admin-actions">
                  <button type="button" className="rk-chip" disabled>
                    Hide
                  </button>
                  <button type="button" className="rk-chip" disabled>
                    Delete
                  </button>
                  <button type="button" className="rk-chip" disabled>
                    Dismiss
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rk-panel">
          <h2>Action Log</h2>
          {logsQuery.isLoading ? <p className="rk-feed-note">Loading action log...</p> : null}
          {(logsQuery.data ?? []).slice(0, 20).length === 0 && !logsQuery.isLoading ? (
            <p className="rk-feed-note">No moderation actions yet.</p>
          ) : null}
          <div className="rk-admin-list">
            {(logsQuery.data ?? []).slice(0, 20).map((log) => (
              <article key={log.id} className="rk-admin-item">
                <strong>{getActionLabel(log.action)}</strong>
                <span>
                  {log.admin_email || '-'} • {formatDateTime(log.created_at)}
                </span>
                <p>Reason: {log.reason || '-'}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}
