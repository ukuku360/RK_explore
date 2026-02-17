import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuthSession } from '../../../app/providers/auth-session-context'
import { formatDateTime } from '../../../lib/formatters'
import { invalidateAfterAdminLogMutation } from '../../../lib/queryInvalidation'
import { createAdminLog } from '../../../services/admin/admin.service'
import { deleteCommunityPost, fetchCommunityPosts } from '../../../services/community/community.service'
import { deletePost, updatePostModeration } from '../../../services/posts/posts.service'
import { reviewReportsByTarget } from '../../../services/reports/reports.service'
import type { Report, ReportTargetType } from '../../../types/domain'
import { usePostsWithRelationsQuery } from '../../feed/hooks/usePostsWithRelationsQuery'
import { useAdminLogsQuery } from '../hooks/useAdminLogsQuery'
import { useAdminReportsQuery } from '../hooks/useAdminReportsQuery'

type ReportQueueItem = {
  targetType: ReportTargetType
  targetId: string
  reportCount: number
  latestCreatedAt: string
  latestReason: string
  reporterLabels: string[]
}

type ReportQueueAccumulator = ReportQueueItem & {
  reporterKeySet: Set<string>
}

function getActionLabel(action: string): string {
  if (action === 'hide') return 'Post Hidden'
  if (action === 'unhide') return 'Post Unhidden'
  if (action === 'delete') return 'Post Deleted'
  if (action === 'dismiss_report') return 'Report Dismissed'
  return 'Moderation Action'
}

function resolveReportTarget(report: Report): { targetType: ReportTargetType; targetId: string } | null {
  if (report.target_type === 'community' && report.community_post_id) {
    return { targetType: 'community', targetId: report.community_post_id }
  }

  if (report.target_type === 'feed' && report.post_id) {
    return { targetType: 'feed', targetId: report.post_id }
  }

  // Legacy rows can miss target_type.
  if (report.community_post_id) {
    return { targetType: 'community', targetId: report.community_post_id }
  }

  if (report.post_id) {
    return { targetType: 'feed', targetId: report.post_id }
  }

  return null
}

function getReporterLabel(report: Report): string {
  const nickname = report.reporter_nickname?.trim() ?? ''
  if (nickname.length > 0) return nickname

  const email = report.reporter_email?.trim() ?? ''
  if (email.length > 0) return email

  return `User ${report.reporter_user_id.slice(0, 8)}`
}

function summarizeContent(content: string): string {
  const normalizedContent = content.trim().replace(/\s+/g, ' ')
  if (normalizedContent.length <= 64) return normalizedContent
  return `${normalizedContent.slice(0, 61)}...`
}

export default function AdminPage() {
  const { user, isAdmin } = useAuthSession()
  const queryClient = useQueryClient()
  const postsQuery = usePostsWithRelationsQuery({ enabled: isAdmin })
  const communityPostsQuery = useQuery({
    queryKey: ['community_posts', 'admin'],
    queryFn: () => fetchCommunityPosts(),
    enabled: isAdmin,
  })
  const reportsQuery = useAdminReportsQuery(isAdmin)
  const logsQuery = useAdminLogsQuery(isAdmin)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusTone, setStatusTone] = useState<'idle' | 'error' | 'success'>('idle')
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null)

  const hiddenPosts = useMemo(() => {
    return (postsQuery.data ?? []).filter((post) => post.is_hidden)
  }, [postsQuery.data])

  const feedPostById = useMemo(() => {
    const map: Record<string, { id: string; location: string }> = {}

    for (const post of postsQuery.data ?? []) {
      map[post.id] = { id: post.id, location: post.location }
    }

    return map
  }, [postsQuery.data])

  const communityPostById = useMemo(() => {
    const map: Record<string, { id: string; author: string; content: string }> = {}

    for (const post of communityPostsQuery.data ?? []) {
      map[post.id] = { id: post.id, author: post.author, content: post.content }
    }

    return map
  }, [communityPostsQuery.data])

  const openReportQueue = useMemo(() => {
    const groupByTarget = new Map<string, ReportQueueAccumulator>()

    for (const report of reportsQuery.data ?? []) {
      if (report.status !== 'open') continue

      const target = resolveReportTarget(report)
      if (!target) continue

      const key = `${target.targetType}:${target.targetId}`
      const reporterLabel = getReporterLabel(report)
      const reporterKey = `${report.reporter_user_id}:${reporterLabel}`

      const current = groupByTarget.get(key)
      if (!current) {
        groupByTarget.set(key, {
          targetType: target.targetType,
          targetId: target.targetId,
          reportCount: 1,
          latestCreatedAt: report.created_at,
          latestReason: report.reason || '-',
          reporterLabels: [reporterLabel],
          reporterKeySet: new Set([reporterKey]),
        })
        continue
      }

      current.reportCount += 1

      if (!current.reporterKeySet.has(reporterKey)) {
        current.reporterKeySet.add(reporterKey)
        current.reporterLabels.push(reporterLabel)
      }

      if (new Date(report.created_at).getTime() > new Date(current.latestCreatedAt).getTime()) {
        current.latestCreatedAt = report.created_at
        current.latestReason = report.reason || '-'
      }
    }

    return [...groupByTarget.values()]
      .map((item) => ({
        targetType: item.targetType,
        targetId: item.targetId,
        reportCount: item.reportCount,
        latestCreatedAt: item.latestCreatedAt,
        latestReason: item.latestReason,
        reporterLabels: item.reporterLabels,
      }))
      .sort((a, b) => new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime())
  }, [reportsQuery.data])

  const openFeedReportQueue = useMemo(() => {
    return openReportQueue.filter((item) => item.targetType === 'feed')
  }, [openReportQueue])

  const openCommunityReportQueue = useMemo(() => {
    return openReportQueue.filter((item) => item.targetType === 'community')
  }, [openReportQueue])

  const totalOpenReports = useMemo(() => {
    return openReportQueue.reduce((sum, item) => sum + item.reportCount, 0)
  }, [openReportQueue])

  async function handleRefresh() {
    await Promise.all([postsQuery.refetch(), communityPostsQuery.refetch(), reportsQuery.refetch(), logsQuery.refetch()])
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

  async function handleHideFeedPost(postId: string) {
    if (!user) return
    const reason = promptForReason('Why are you hiding this feed post? (required)')
    if (!reason) return

    await runAdminAction(`hide:feed:${postId}`, async () => {
      await updatePostModeration(postId, {
        is_hidden: true,
        hidden_reason: reason,
        hidden_by: user.id,
        hidden_at: new Date().toISOString(),
      })

      await reviewReportsByTarget({
        target_type: 'feed',
        target_id: postId,
        status: 'actioned',
        reviewed_by_user_id: user.id,
      })

      await createAdminLog({
        post_id: postId,
        report_id: null,
        action: 'hide',
        reason,
        admin_user_id: user.id,
        admin_email: user.email,
      })

      setStatusTone('success')
      setStatusMessage('Feed post hidden.')
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

  async function handleDeleteTarget(targetType: ReportTargetType, targetId: string, targetLabel: string) {
    if (!user) return
    const reason = promptForReason('Why are you deleting this post? (required)')
    if (!reason) return

    if (!window.confirm('Delete this post permanently? This cannot be undone.')) return

    await runAdminAction(`delete:${targetType}:${targetId}`, async () => {
      if (targetType === 'feed') {
        await deletePost(targetId)
      } else {
        await deleteCommunityPost(targetId)
        await queryClient.invalidateQueries({ queryKey: ['community_posts'] })
      }

      await reviewReportsByTarget({
        target_type: targetType,
        target_id: targetId,
        status: 'actioned',
        reviewed_by_user_id: user.id,
      })

      await createAdminLog({
        post_id: targetType === 'feed' ? targetId : null,
        report_id: null,
        action: 'delete',
        reason: `${reason} (Deleted ${targetType} post: ${targetLabel})`,
        admin_user_id: user.id,
        admin_email: user.email,
      })

      setStatusTone('success')
      setStatusMessage(`${targetType === 'feed' ? 'Feed' : 'Community'} post deleted by admin.`)
    })
  }

  async function handleDismissTarget(targetType: ReportTargetType, targetId: string) {
    if (!user) return
    const reason = promptForReason('Why are you dismissing these reports? (required)')
    if (!reason) return

    await runAdminAction(`dismiss:${targetType}:${targetId}`, async () => {
      await reviewReportsByTarget({
        target_type: targetType,
        target_id: targetId,
        status: 'dismissed',
        reviewed_by_user_id: user.id,
      })

      await createAdminLog({
        post_id: targetType === 'feed' ? targetId : null,
        report_id: null,
        action: 'dismiss_report',
        reason,
        admin_user_id: user.id,
        admin_email: user.email,
      })

      setStatusTone('success')
      setStatusMessage('Reports dismissed.')
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
      <p>Monitor feed/community reports, review reporters, and follow up with logged moderation actions.</p>
      {statusMessage ? (
        <p className={statusTone === 'error' ? 'rk-auth-message rk-auth-error' : 'rk-auth-message rk-auth-success'}>
          {statusMessage}
        </p>
      ) : null}

      <div className="rk-admin-top">
        <div className="rk-admin-stats">
          <div className="rk-admin-stat">
            <span>Open report targets</span>
            <strong>{openReportQueue.length}</strong>
          </div>
          <div className="rk-admin-stat">
            <span>Open reports</span>
            <strong>{totalOpenReports}</strong>
          </div>
          <div className="rk-admin-stat">
            <span>Hidden feed posts</span>
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
          <h2>Feed Report Queue</h2>
          {reportsQuery.isLoading || postsQuery.isLoading ? <p className="rk-feed-note">Loading feed reports...</p> : null}
          {openFeedReportQueue.length === 0 && !reportsQuery.isLoading ? (
            <p className="rk-feed-note">No open feed reports.</p>
          ) : null}
          <div className="rk-admin-list">
            {openFeedReportQueue.map((item) => {
              const targetPost = feedPostById[item.targetId]
              const hasLinkedPost = Boolean(targetPost)

              return (
                <article key={`feed:${item.targetId}`} className="rk-admin-item">
                  <strong>{targetPost?.location ?? 'Deleted feed post'}</strong>
                  <span>
                    Reports {item.reportCount} • Last: {formatDateTime(item.latestCreatedAt)}
                  </span>
                  <span>Reporters: {item.reporterLabels.join(', ') || '-'}</span>
                  <p>Latest reason: {item.latestReason || '-'}</p>
                  <div className="rk-admin-actions">
                    {hasLinkedPost ? (
                      <button
                        type="button"
                        className="rk-chip"
                        onClick={() => void handleHideFeedPost(item.targetId)}
                        disabled={pendingActionKey !== null}
                      >
                        Hide
                      </button>
                    ) : null}
                    {hasLinkedPost ? (
                      <button
                        type="button"
                        className="rk-chip"
                        onClick={() => void handleDeleteTarget('feed', item.targetId, targetPost.location)}
                        disabled={pendingActionKey !== null}
                      >
                        Delete
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rk-chip"
                      onClick={() => void handleDismissTarget('feed', item.targetId)}
                      disabled={pendingActionKey !== null}
                    >
                      Dismiss
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="rk-panel">
          <h2>Community Report Queue</h2>
          {reportsQuery.isLoading || communityPostsQuery.isLoading ? (
            <p className="rk-feed-note">Loading community reports...</p>
          ) : null}
          {openCommunityReportQueue.length === 0 && !reportsQuery.isLoading ? (
            <p className="rk-feed-note">No open community reports.</p>
          ) : null}
          <div className="rk-admin-list">
            {openCommunityReportQueue.map((item) => {
              const targetPost = communityPostById[item.targetId]
              const hasLinkedPost = Boolean(targetPost)
              const postLabel = targetPost
                ? `${targetPost.author}: ${summarizeContent(targetPost.content)}`
                : 'Deleted community post'

              return (
                <article key={`community:${item.targetId}`} className="rk-admin-item">
                  <strong>{postLabel}</strong>
                  <span>
                    Reports {item.reportCount} • Last: {formatDateTime(item.latestCreatedAt)}
                  </span>
                  <span>Reporters: {item.reporterLabels.join(', ') || '-'}</span>
                  <p>Latest reason: {item.latestReason || '-'}</p>
                  <div className="rk-admin-actions">
                    {hasLinkedPost ? (
                      <button
                        type="button"
                        className="rk-chip"
                        onClick={() => void handleDeleteTarget('community', item.targetId, postLabel)}
                        disabled={pendingActionKey !== null}
                      >
                        Delete
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rk-chip"
                      onClick={() => void handleDismissTarget('community', item.targetId)}
                      disabled={pendingActionKey !== null}
                    >
                      Dismiss
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="rk-panel">
          <h2>Hidden Feed Posts</h2>
          {hiddenPosts.length === 0 ? <p className="rk-feed-note">No hidden feed posts.</p> : null}
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
                    onClick={() => void handleDeleteTarget('feed', post.id, post.location)}
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
          {(logsQuery.data ?? []).slice(0, 40).length === 0 && !logsQuery.isLoading ? (
            <p className="rk-feed-note">No moderation actions yet.</p>
          ) : null}
          <div className="rk-admin-list">
            {(logsQuery.data ?? []).slice(0, 40).map((log) => (
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
