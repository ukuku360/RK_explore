export const queryKeys = {
  feed: {
    all: ['feed'] as const,
    postsWithRelations: () => ['feed', 'posts-with-relations'] as const,
  },
  posts: {
    all: ['posts'] as const,
    list: () => ['posts', 'list'] as const,
    detail: (postId: string) => ['posts', 'detail', postId] as const,
  },
  votes: {
    all: ['votes'] as const,
    byPostIds: (postIdsHash: string) => ['votes', 'by-post-ids', postIdsHash] as const,
  },
  rsvps: {
    all: ['rsvps'] as const,
    byPostIds: (postIdsHash: string) => ['rsvps', 'by-post-ids', postIdsHash] as const,
  },
  comments: {
    all: ['comments'] as const,
    byPostIds: (postIdsHash: string) => ['comments', 'by-post-ids', postIdsHash] as const,
  },
  reports: {
    all: ['reports'] as const,
    list: () => ['reports', 'list'] as const,
    byReporter: (reporterUserId: string) => ['reports', 'by-reporter', reporterUserId] as const,
  },
  adminLogs: {
    all: ['admin-logs'] as const,
    list: () => ['admin-logs', 'list'] as const,
  },
  analytics: {
    all: ['analytics'] as const,
    events: (windowDays: number) => ['analytics', 'events', windowDays] as const,
  },
  profile: {
    all: ['profile'] as const,
    details: (userId: string) => ['profile', 'details', userId] as const,
    avatars: (userIdsHash: string) => ['profile', 'avatars', userIdsHash] as const,
  },
  marketplace: {
    all: ['marketplace'] as const,
    posts: () => ['marketplace', 'posts'] as const,
    postDetail: (postId: string) => ['marketplace', 'post', postId] as const,
  },
  marketplaceComments: {
    all: ['marketplace-comments'] as const,
    byPost: (postId: string) => ['marketplace-comments', 'post', postId] as const,
  },
  marketplaceBids: {
    all: ['marketplace-bids'] as const,
    byPost: (postId: string) => ['marketplace-bids', 'post', postId] as const,
  },
  marketplaceBidEvents: {
    all: ['marketplace-bid-events'] as const,
    byPost: (postId: string) => ['marketplace-bid-events', 'post', postId] as const,
  },
  marketplaceChats: {
    all: ['marketplace-chats'] as const,
    threads: (viewerId: string) => ['marketplace-chats', 'threads', viewerId] as const,
    messages: (threadId: string) => ['marketplace-chats', 'messages', threadId] as const,
  },
  marketplaceTransactions: {
    all: ['marketplace-transactions'] as const,
    byPost: (postId: string) => ['marketplace-transactions', 'post', postId] as const,
  },
} as const

export type RealtimeTableName =
  | 'posts'
  | 'votes'
  | 'rsvps'
  | 'comments'
  | 'post_reports'
  | 'admin_action_logs'
  | 'user_profile_details'
  | 'marketplace_posts'
  | 'marketplace_comments'
  | 'marketplace_bids'
  | 'marketplace_bid_events'
  | 'marketplace_chat_threads'
  | 'marketplace_chat_messages'
  | 'marketplace_transactions'
