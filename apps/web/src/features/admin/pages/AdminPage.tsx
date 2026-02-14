import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { useAuthSession } from '../../../app/providers/auth-session-context'
import { formatDateTime } from '../../../lib/formatters'
import { invalidateAfterAdminLogMutation } from '../../../lib/queryInvalidation'
import { createAdminLog } from '../../../services/admin/admin.service'
import { deletePost, updatePostModeration } from '../../../services/posts/posts.service'
import { reviewReport } from '../../../services/reports/reports.service'
import { usePostsWithRelationsQuery } from '../../feed/hooks/usePostsWithRelationsQuery'
import { useAdminLogsQuery } from '../hooks/useAdminLogsQuery'
import { useAdminReportsQuery } from '../hooks/useAdminReportsQuery'

function getActionLabel(action: string): string {
  if (action === 'hide') return 'Post Hidden'
  if (action === 'unhide') return 'Post Unhidden'
  if (action === 'delete') return 'Post Deleted'
  if (action === 'dismiss_report') return 'Report Dismissed'
  return 'Moderation Action'
}

export default function AdminPage() {
  const { user, isAdmin } = useAuthSession()
  const queryClient = useQueryClient()
  const postsQuery = usePostsWithRelationsQuery({ enabled: isAdmin })
  const reportsQuery = useAdminReportsQuery(isAdmin)
  const logsQuery = useAdminLogsQuery(isAdmin)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusTone, setStatusTone] = useState<'idle' | 'error' | 'success'>('idle')
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null)

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

  function promptForReason(promptText: string, minLength = 5): string | null {
    const raw = window.prompt(promptText, '')
    if (raw === null) return null

    const clean = raw.trim().replace(/\s+/g, ' ').slice(0, 500)
    if (clean.length < minLength) {
      setStatusTone('error')
      setStatusMessage(`Please provide at least ${minLength} characters.`)
      return null
    }

    return clean
  }

  async function runAdminAction(actionKey: string, action: () => Promise<void>) {
    setPendingActionKey(actionKey)

    try {
      await action()
      await invalidateAfterAdminLogMutation(queryClient)
    } catch (error) {
      setStatusTone('error')
      setStatusMessage(error instanceof Error ? error.message : 'Admin action failed.')
    } finally {
      setPendingActionKey(null)
    }
  }

  async function handleHide(postId: string, reportId: string | null) {
    if (!user) return
    const reason = promptForReason('Why are you hiding this post? (required)')
    if (!reason) return

    await runAdminAction(`hide:${postId}:${reportId ?? ''}`, async () => {
      await updatePostModeration(postId, {
        is_hidden: true,
        hidden_reason: reason,
        hidden_by: user.id,
        hidden_at: new Date().toISOString(),
      })

      if (reportId) {
        await reviewReport(reportId, 'actioned', user.id)
      }

      await createAdminLog({
        post_id: postId,
        report_id: reportId,
        action: 'hide',
        reason,
        admin_user_id: user.id,
        admin_email: user.email,
      })

      setStatusTone('success')
      setStatusMessage('Post hidden.')
    })
  }

  async function handleUnhide(postId: string) {
    if (!user) return
    const reason = promptForReason('Why are you un-hiding this post? (required)')
    if (!reason) return

    await runAdminAction(`unhide:${postId}`, async () => {
      await updatePostModeration(postId, {
        is_hidden: false,
        hidden_reason: null,
        hidden_by: null,
        hidden_at: null,
      })

      await createAdminLog({
        post_id: postId,
        report_id: null,
        action: 'unhide',
        reason,
        admin_user_id: user.id,
        admin_email: user.email,
      })

      setStatusTone('success')
      setStatusMessage('Post is visible again.')
    })
  }

  async function handleDelete(postId: string, reportId: string | null) {
    if (!user) return
    const reason = promptForReason('Why are you deleting this post? (required)')
    if (!reason) return

    const postTitle = postTitleById[postId] ?? 'Unknown'
    if (!window.confirm('Delete this post permanently? This cannot be undone.')) return

    await runAdminAction(`delete:${postId}:${reportId ?? ''}`, async () => {
      await deletePost(postId)

      if (reportId) {
        await reviewReport(reportId, 'actioned', user.id)
      }

      await createAdminLog({
        post_id: null,
        report_id: reportId,
        action: 'delete',
        reason: `${reason} (Deleted post: ${postTitle})`,
        admin_user_id: user.id,
        admin_email: user.email,
      })

      setStatusTone('success')
      setStatusMessage('Post deleted by admin.')
    })
  }

  async function handleDismiss(reportId: string, postId: string | null) {
    if (!user) return
    const reason = promptForReason('Why are you dismissing this report? (required)')
    if (!reason) return

    await runAdminAction(`dismiss:${reportId}`, async () => {
      await reviewReport(reportId, 'dismissed', user.id)

      await createAdminLog({
        post_id: postId,
        report_id: reportId,
        action: 'dismiss_report',
        reason,
        admin_user_id: user.id,
        admin_email: user.email,
      })

      setStatusTone('success')
      setStatusMessage('Report dismissed.')
    })
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
      <p>Review reports, moderate posts, and keep a clear decision trail.</p>
      {statusMessage ? (
        <p className={statusTone === 'error' ? 'rk-auth-message rk-auth-error' : 'rk-auth-message rk-auth-success'}>
          {statusMessage}
        </p>
      ) : null}

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
              (() => {
                const hasLinkedPost = Boolean(postTitleById[report.post_id])
                return (
                  <article key={report.id} className="rk-admin-item">
                    <strong>Report: {postTitleById[report.post_id] ?? 'Deleted post'}</strong>
                    <span>
                      {report.reporter_email} • {formatDateTime(report.created_at)}
                    </span>
                    <p>Reason: {report.reason || '-'}</p>
                    <div className="rk-admin-actions">
                      {hasLinkedPost ? (
                        <button
                          type="button"
                          className="rk-chip"
                          onClick={() => void handleHide(report.post_id, report.id)}
                          disabled={pendingActionKey !== null}
                        >
                          Hide
                        </button>
                      ) : null}
                      {hasLinkedPost ? (
                        <button
                          type="button"
                          className="rk-chip"
                          onClick={() => void handleDelete(report.post_id, report.id)}
                          disabled={pendingActionKey !== null}
                        >
                          Delete
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="rk-chip"
                        onClick={() => void handleDismiss(report.id, hasLinkedPost ? report.post_id : null)}
                        disabled={pendingActionKey !== null}
                      >
                        Dismiss
                      </button>
                    </div>
                  </article>
                )
              })()
            ))}
          </div>
        </section>

        <section className="rk-panel">
          <h2>Hidden Posts</h2>
          {hiddenPosts.length === 0 ? <p className="rk-feed-note">No hidden posts.</p> : null}
          <div className="rk-admin-list">
            {hiddenPosts.map((post) => (
              <article key={post.id} className="rk-admin-item">
                <strong>{post.location}</strong>
                <span>Hidden reason: {post.hidden_reason || '-'}</span>
                <span>Hidden at: {post.hidden_at ? formatDateTime(post.hidden_at) : '-'}</span>
                <div className="rk-admin-actions">
                  <button
                    type="button"
                    className="rk-chip"
                    onClick={() => void handleUnhide(post.id)}
                    disabled={pendingActionKey !== null}
                  >
                    Unhide
                  </button>
                  <button
                    type="button"
                    className="rk-chip"
                    onClick={() => void handleDelete(post.id, null)}
                    disabled={pendingActionKey !== null}
                  >
                    Delete
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
