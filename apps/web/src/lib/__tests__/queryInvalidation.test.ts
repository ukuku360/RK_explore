import type { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import {
  invalidateAfterAdminLogMutation,
  invalidateAfterCommentMutation,
  invalidateAfterPostMutation,
  invalidateAfterReportMutation,
  invalidateAfterRsvpMutation,
  invalidateAfterVoteMutation,
  invalidateForRealtimeTable,
} from '../queryInvalidation'
import { queryKeys } from '../queryKeys'

function createFakeQueryClient() {
  const mutableCalls: Array<readonly unknown[]> = []

  const client = {
    invalidateQueries: async ({
      queryKey,
    }: {
      queryKey: readonly unknown[]
    }): Promise<void> => {
      mutableCalls.push(queryKey)
    },
  } as unknown as QueryClient

  return { client, mutableCalls }
}

function expectKeysToContain(
  calls: Array<readonly unknown[]>,
  expected: ReadonlyArray<readonly unknown[]>,
) {
  for (const key of expected) {
    expect(calls).toContainEqual(key)
  }
}

describe('query invalidation rules', () => {
  it('invalidates feed read models after post mutation', async () => {
    const { client, mutableCalls } = createFakeQueryClient()
    await invalidateAfterPostMutation(client)

    expectKeysToContain(mutableCalls, [
      queryKeys.feed.all,
      queryKeys.posts.all,
      queryKeys.votes.all,
      queryKeys.rsvps.all,
      queryKeys.comments.all,
    ])
  })

  it('invalidates scoped keys for vote/rsvp/comment/report/admin log mutations', async () => {
    const vote = createFakeQueryClient()
    await invalidateAfterVoteMutation(vote.client)
    expectKeysToContain(vote.mutableCalls, [queryKeys.votes.all, queryKeys.feed.all, queryKeys.posts.all])

    const rsvp = createFakeQueryClient()
    await invalidateAfterRsvpMutation(rsvp.client)
    expectKeysToContain(rsvp.mutableCalls, [queryKeys.rsvps.all, queryKeys.feed.all, queryKeys.posts.all])

    const comment = createFakeQueryClient()
    await invalidateAfterCommentMutation(comment.client)
    expectKeysToContain(comment.mutableCalls, [queryKeys.comments.all, queryKeys.feed.all])

    const report = createFakeQueryClient()
    await invalidateAfterReportMutation(report.client)
    expectKeysToContain(report.mutableCalls, [queryKeys.reports.all, queryKeys.posts.all, queryKeys.feed.all])

    const adminLog = createFakeQueryClient()
    await invalidateAfterAdminLogMutation(adminLog.client)
    expectKeysToContain(adminLog.mutableCalls, [
      queryKeys.adminLogs.all,
      queryKeys.reports.all,
      queryKeys.posts.all,
      queryKeys.feed.all,
    ])
  })

  it('maps realtime table events to expected invalidation groups', async () => {
    const feedSide = createFakeQueryClient()
    await invalidateForRealtimeTable(feedSide.client, 'posts')
    expectKeysToContain(feedSide.mutableCalls, [
      queryKeys.feed.all,
      queryKeys.posts.all,
      queryKeys.votes.all,
      queryKeys.rsvps.all,
      queryKeys.comments.all,
    ])

    const moderationSide = createFakeQueryClient()
    await invalidateForRealtimeTable(moderationSide.client, 'post_reports')
    expectKeysToContain(moderationSide.mutableCalls, [
      queryKeys.reports.all,
      queryKeys.adminLogs.all,
      queryKeys.posts.all,
      queryKeys.feed.all,
    ])
  })
})
