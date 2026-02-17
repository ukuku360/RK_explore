export const CATEGORIES = ['Sports', 'Culture', 'Eatout', 'Travel', 'Study', 'Extra'] as const
export type Category = (typeof CATEGORIES)[number]

export const POST_STATUSES = ['proposed', 'confirmed'] as const
export type PostStatus = (typeof POST_STATUSES)[number]

export const REPORT_STATUSES = ['open', 'dismissed', 'actioned'] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]

export const REPORT_TARGET_TYPES = ['feed', 'community'] as const
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number]

export const ADMIN_ACTIONS = ['hide', 'unhide', 'delete', 'dismiss_report'] as const
export type AdminAction = (typeof ADMIN_ACTIONS)[number]

export type Vote = {
  id: string
  post_id: string
  user_id: string
  created_at: string
}

export type Rsvp = {
  id: string
  post_id: string
  user_id: string
  created_at: string
}

export type Comment = {
  id: string
  post_id: string
  parent_comment_id: string | null
  user_id: string | null
  author: string
  text: string
  created_at: string
}

export type PostRecord = {
  id: string
  location: string
  author: string
  user_id: string
  proposed_date: string | null
  category: Category
  status: PostStatus
  capacity: number
  meetup_place: string | null
  meeting_time: string | null
  estimated_cost: number | null
  prep_notes: string | null
  rsvp_deadline: string | null
  is_hidden: boolean
  hidden_reason: string | null
  hidden_by: string | null
  hidden_at: string | null
  created_at: string
}

export type Post = PostRecord & {
  votes: Vote[]
  rsvps: Rsvp[]
  comments: Comment[]
}

export type CreatePostInput = {
  location: string
  author: string
  user_id: string
  proposed_date?: string | null
  category: Category
  status?: PostStatus
  capacity: number
  meetup_place?: string | null
  meeting_time?: string | null
  estimated_cost?: number | null
  prep_notes?: string | null
  rsvp_deadline?: string | null
}

export type UpdatePostModerationInput = {
  is_hidden: boolean
  hidden_reason: string | null
  hidden_by: string | null
  hidden_at: string | null
}

export type Report = {
  id: string
  target_type: ReportTargetType
  post_id: string | null
  community_post_id: string | null
  reporter_user_id: string
  reporter_email: string
  reporter_nickname: string
  reason: string
  status: ReportStatus
  created_at: string
  reviewed_by: string | null
  reviewed_at: string | null
}

export type AdminLog = {
  id: string
  post_id: string | null
  report_id: string | null
  action: AdminAction
  reason: string
  admin_user_id: string
  admin_email: string
  created_at: string
}

export type CommunityComment = {
  id: string
  post_id: string
  user_id: string
  author: string
  content: string
  created_at: string
}

export type CommunityPost = {
  id: string
  user_id: string
  author: string
  content: string
  created_at: string
  likes_count: number
  comments_count: number
  has_liked: boolean
}
