import type {
  CommunityCategorySettings,
  CommunityPolicySnapshot,
  CommunityPolicyVersion,
  CommunityPostCategory,
} from '../../types/domain'
import { COMMUNITY_POST_CATEGORIES } from '../../types/domain'
import { supabaseClient } from '../supabase/client'
import { throwIfPostgrestError } from '../supabase/errors'

const DEFAULT_ALLOWED_CATEGORIES = [...COMMUNITY_POST_CATEGORIES]

function normalizeAllowedCategories(rawCategories: unknown): CommunityPostCategory[] {
  if (!Array.isArray(rawCategories)) return DEFAULT_ALLOWED_CATEGORIES

  const values = rawCategories.filter((value): value is CommunityPostCategory =>
    typeof value === 'string' && COMMUNITY_POST_CATEGORIES.includes(value as CommunityPostCategory),
  )

  if (values.length === 0) return DEFAULT_ALLOWED_CATEGORIES
  return [...new Set(values)]
}

export async function fetchCommunityPolicySnapshot(userId: string): Promise<CommunityPolicySnapshot> {
  const [activePolicyResult, categorySettingsResult] = await Promise.all([
    supabaseClient
      .from('community_policy_versions')
      .select('version, title, summary, terms_markdown, is_active, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseClient
      .from('community_user_category_settings')
      .select('user_id, allowed_categories, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  throwIfPostgrestError(activePolicyResult.error)
  throwIfPostgrestError(categorySettingsResult.error)

  const activePolicy = (activePolicyResult.data ?? null) as CommunityPolicyVersion | null
  const settings = (categorySettingsResult.data ?? null) as CommunityCategorySettings | null
  const allowedCategories = normalizeAllowedCategories(settings?.allowed_categories)

  if (!activePolicy?.version) {
    return {
      activePolicyVersion: null,
      activePolicyTitle: '',
      activePolicySummary: '',
      activePolicyTermsMarkdown: '',
      hasAcceptedActivePolicy: true,
      allowedCategories,
    }
  }

  const consentResult = await supabaseClient
    .from('community_policy_consents')
    .select('user_id')
    .eq('user_id', userId)
    .eq('policy_version', activePolicy.version)
    .maybeSingle()

  throwIfPostgrestError(consentResult.error)

  return {
    activePolicyVersion: activePolicy.version,
    activePolicyTitle: activePolicy.title,
    activePolicySummary: activePolicy.summary,
    activePolicyTermsMarkdown: activePolicy.terms_markdown,
    hasAcceptedActivePolicy: Boolean(consentResult.data),
    allowedCategories,
  }
}

export async function upsertCommunityCategorySettings(
  userId: string,
  allowedCategories: CommunityPostCategory[],
): Promise<CommunityCategorySettings> {
  const normalizedAllowedCategories = normalizeAllowedCategories(allowedCategories)

  const { data, error } = await supabaseClient
    .from('community_user_category_settings')
    .upsert(
      {
        user_id: userId,
        allowed_categories: normalizedAllowedCategories,
      },
      { onConflict: 'user_id' },
    )
    .select('user_id, allowed_categories, created_at, updated_at')
    .single()

  throwIfPostgrestError(error)
  return data as CommunityCategorySettings
}

export async function acceptActiveCommunityPolicy(userId: string): Promise<void> {
  const activePolicyResult = await supabaseClient
    .from('community_policy_versions')
    .select('version')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  throwIfPostgrestError(activePolicyResult.error)

  const activeVersion = activePolicyResult.data?.version ?? null
  if (!activeVersion) return

  const { error } = await supabaseClient
    .from('community_policy_consents')
    .upsert(
      {
        user_id: userId,
        policy_version: activeVersion,
      },
      { onConflict: 'user_id,policy_version' },
    )

  throwIfPostgrestError(error)
}
