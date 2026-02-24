export const CATEGORIES = ['Sports', 'Culture', 'Eatout', 'Travel', 'Study', 'Extra'] as const
export type Category = (typeof CATEGORIES)[number]

export const POST_STATUSES = ['proposed', 'confirmed'] as const
export type PostStatus = (typeof POST_STATUSES)[number]

export const COMMUNITY_POST_CATEGORIES = [
  'general',
  'free_stuff',
  'laundry_done',
  'ideas',
  'lost_and_found',
  'help_needed',
  'noise_alert',
  'marketplace',
] as const
export type CommunityPostCategory = (typeof COMMUNITY_POST_CATEGORIES)[number]

export const COMMUNITY_POST_CATEGORY_META: Record<CommunityPostCategory, { label: string; emoji: string }> = {
  general: { label: 'General', emoji: '📋' },
  free_stuff: { label: 'Free Stuff', emoji: '🎁' },
  laundry_done: { label: 'Laundry Done', emoji: '🧺' },
  ideas: { label: 'Ideas', emoji: '💡' },
  lost_and_found: { label: 'Lost & Found', emoji: '🔍' },
  help_needed: { label: 'Help Needed', emoji: '🤝' },
  noise_alert: { label: 'Noise Alert', emoji: '🔔' },
  marketplace: { label: 'Marketplace', emoji: '🛒' },
}

export const REPORT_STATUSES = ['open', 'dismissed', 'actioned'] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]

export const REPORT_TARGET_TYPES = ['feed', 'community'] as const
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number]

export const ADMIN_ACTIONS = ['hide', 'unhide', 'delete', 'dismiss_report'] as const
export type AdminAction = (typeof ADMIN_ACTIONS)[number]

export const ANALYTICS_ROLES = ['admin', 'member'] as const
export type AnalyticsRole = (typeof ANALYTICS_ROLES)[number]

export const ANALYTICS_EVENT_NAMES = [
  'feed_view',
  'post_create_start',
  'post_step1_valid',
  'post_create_success',
  'post_create_fail',
  'filter_applied',
  'filter_cleared',
  'personalized_tab_viewed',
  'empty_state_cta_clicked',
  'mobile_create_start',
  'vote_cast',
  'rsvp_join',
] as const
export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number]

export type AnalyticsProperties = Record<string, string | number | boolean | null>

export type AnalyticsEvent = {
  id: string
  event_name: string
  user_id: string
  role: AnalyticsRole
  post_id: string | null
  surface: string
  properties: AnalyticsProperties
  created_at: string
}

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
  image_url: string | null
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
  image_url?: string | null
}

export type UpdatePostModerationInput = {
  is_hidden: boolean
  hidden_reason: string | null
  hidden_by: string | null
  hidden_at: string | null
}


export type ProfileDetails = {
  tagline: string
  bio: string
  location: string
  country: string
  city: string
  uni: string
  major: string
  instagram_url: string
  linkedin_url: string
  occupations: string
  hobbies: string
  links: string
  avatar_url: string | null
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
  category: CommunityPostCategory
  created_at: string
  likes_count: number
  comments_count: number
  has_liked: boolean
}

export type CommunityCategorySettings = {
  user_id: string
  allowed_categories: CommunityPostCategory[]
  created_at: string
  updated_at: string
}

export type CommunityPolicyVersion = {
  version: string
  title: string
  summary: string
  terms_markdown: string
  is_active: boolean
  created_at: string
}

export type CommunityPolicySnapshot = {
  activePolicyVersion: string | null
  activePolicyTitle: string
  activePolicySummary: string
  activePolicyTermsMarkdown: string
  hasAcceptedActivePolicy: boolean
  allowedCategories: CommunityPostCategory[]
}
