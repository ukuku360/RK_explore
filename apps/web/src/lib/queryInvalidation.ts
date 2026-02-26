import type { QueryClient } from '@tanstack/react-query'

import { queryKeys, type RealtimeTableName } from './queryKeys'

async function invalidateFeedReadModels(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.feed.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.posts.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.votes.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.rsvps.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.comments.all }),
  ])
}

async function invalidateProfileReadModels(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.profile.all })
}

async function invalidateModerationReadModels(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.reports.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.adminLogs.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.posts.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.feed.all }),
  ])
}

async function invalidateMarketplaceReadModels(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceComments.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceBids.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceBidEvents.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceChats.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceTransactions.all }),
  ])
}

export async function invalidateAfterPostMutation(queryClient: QueryClient): Promise<void> {
  await invalidateFeedReadModels(queryClient)
}

export async function invalidateAfterVoteMutation(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.votes.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.feed.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.posts.all }),
  ])
}

export async function invalidateAfterRsvpMutation(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.rsvps.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.feed.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.posts.all }),
  ])
}

export async function invalidateAfterCommentMutation(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.comments.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.feed.all }),
  ])
}

export async function invalidateAfterReportMutation(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.reports.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.posts.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.feed.all }),
  ])
}

export async function invalidateAfterAdminLogMutation(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.adminLogs.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.reports.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.posts.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.feed.all }),
  ])
}

export async function invalidateAfterMarketplaceMutation(queryClient: QueryClient): Promise<void> {
  await invalidateMarketplaceReadModels(queryClient)
}

export async function invalidateForRealtimeTable(
  queryClient: QueryClient,
  tableName: RealtimeTableName,
): Promise<void> {
  if (tableName === 'post_reports' || tableName === 'admin_action_logs') {
    await invalidateModerationReadModels(queryClient)
    return
  }

  if (
    tableName === 'marketplace_posts' ||
    tableName === 'marketplace_comments' ||
    tableName === 'marketplace_bids' ||
    tableName === 'marketplace_bid_events' ||
    tableName === 'marketplace_chat_threads' ||
    tableName === 'marketplace_chat_messages' ||
    tableName === 'marketplace_transactions'
  ) {
    await invalidateMarketplaceReadModels(queryClient)
    return
  }

  if (tableName === 'user_profile_details') {
    await invalidateProfileReadModels(queryClient)
    return
  }

  await invalidateFeedReadModels(queryClient)
}
