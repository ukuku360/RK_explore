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
  profile: {
    all: ['profile'] as const,
    details: (userId: string) => ['profile', 'details', userId] as const,
    avatars: (userIdsHash: string) => ['profile', 'avatars', userIdsHash] as const,
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
