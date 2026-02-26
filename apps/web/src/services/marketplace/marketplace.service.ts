import {
  MARKETPLACE_BID_EVENT_TYPES,
  MARKETPLACE_POST_STATUSES,
  type MarketplaceBid,
  type MarketplaceBidEvent,
  type MarketplaceBidEventType,
  type MarketplaceComment,
  type MarketplacePost,
  type MarketplacePostStatus,
} from '../../types/domain'
import { enforceLength, INPUT_LIMITS } from '../../lib/inputLimits'
import { supabaseClient } from '../supabase/client'
import { throwIfPostgrestError } from '../supabase/errors'

type MarketplacePostRow = {
  id: string
  seller_user_id: string
  seller_nickname: string
  title: string
  description: string
  asking_price: number | string
  image_url: string | null
  status: string | null
  created_at: string
  updated_at: string | null
}

type MarketplaceCommentRow = MarketplaceComment

type MarketplaceBidRow = {
  id: string
  post_id: string
  bidder_user_id: string
  bidder_nickname: string
  amount: number | string
  created_at: string
  updated_at: string | null
}

type MarketplaceBidEventRow = {
  id: string
  bid_id: string
  post_id: string
  bidder_user_id: string
  bidder_nickname: string
  amount: number | string
  event_type: string | null
  created_at: string
}

type CreateMarketplacePostInput = {
  sellerUserId: string
  sellerNickname: string
  title: string
  description: string
  askingPrice: number
  imageUrl: string | null
}

type UpdateMarketplacePostInput = {
  title?: string
  description?: string
  askingPrice?: number
  imageUrl?: string | null
  status?: MarketplacePostStatus
}

function normalizeMoney(value: number): number {
  return Number(value.toFixed(2))
}

function parseMoney(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function normalizeStatus(value: string | null | undefined): MarketplacePostStatus {
  if (value && MARKETPLACE_POST_STATUSES.includes(value as MarketplacePostStatus)) {
    return value as MarketplacePostStatus
  }
  return 'active'
}

function normalizeBidEventType(value: string | null | undefined): MarketplaceBidEventType {
  if (value && MARKETPLACE_BID_EVENT_TYPES.includes(value as MarketplaceBidEventType)) {
    return value as MarketplaceBidEventType
  }
  return 'updated'
}

function toMarketplaceBid(row: MarketplaceBidRow): MarketplaceBid {
  return {
    id: row.id,
    post_id: row.post_id,
    bidder_user_id: row.bidder_user_id,
    bidder_nickname: row.bidder_nickname,
    amount: parseMoney(row.amount),
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
  }
}

function toMarketplacePost(
  row: MarketplacePostRow,
  bids: MarketplaceBid[],
  commentsCount: number,
  currentUserId?: string,
): MarketplacePost {
  const sortedBids = [...bids].sort((a, b) => {
    const amountGap = b.amount - a.amount
    if (amountGap !== 0) return amountGap
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })
  const highestBid = sortedBids[0] ?? null
  const myBid = currentUserId
    ? sortedBids.find((bid) => bid.bidder_user_id === currentUserId)
    : null

  return {
    id: row.id,
    seller_user_id: row.seller_user_id,
    seller_nickname: row.seller_nickname,
    title: row.title,
    description: row.description,
    asking_price: parseMoney(row.asking_price),
    image_url: row.image_url,
    status: normalizeStatus(row.status),
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
    bids_count: bids.length,
    comments_count: commentsCount,
    highest_bid_amount: highestBid ? highestBid.amount : null,
    highest_bidder_nickname: highestBid ? highestBid.bidder_nickname : null,
    my_bid_amount: myBid ? myBid.amount : null,
  }
}

export async function fetchMarketplacePosts(currentUserId?: string): Promise<MarketplacePost[]> {
  const { data: posts, error } = await supabaseClient
    .from('marketplace_posts')
    .select('*')
    .order('created_at', { ascending: false })

  throwIfPostgrestError(error)

  if (!posts || posts.length === 0) return []

  const postIds = posts.map((post) => post.id)
  const [bidsResult, commentsResult] = await Promise.all([
    supabaseClient
      .from('marketplace_bids')
      .select('id, post_id, bidder_user_id, bidder_nickname, amount, created_at, updated_at')
      .in('post_id', postIds),
    supabaseClient.from('marketplace_comments').select('post_id').in('post_id', postIds),
  ])
  throwIfPostgrestError(bidsResult.error)
  throwIfPostgrestError(commentsResult.error)

  const bidsByPost = new Map<string, MarketplaceBid[]>()
  for (const row of (bidsResult.data ?? []) as MarketplaceBidRow[]) {
    const bucket = bidsByPost.get(row.post_id) ?? []
    bucket.push(toMarketplaceBid(row))
    bidsByPost.set(row.post_id, bucket)
  }

  const commentsCountByPost = new Map<string, number>()
  for (const row of commentsResult.data ?? []) {
    const postId = row.post_id
    commentsCountByPost.set(postId, (commentsCountByPost.get(postId) ?? 0) + 1)
  }

  return (posts as MarketplacePostRow[]).map((row) =>
    toMarketplacePost(
      row,
      bidsByPost.get(row.id) ?? [],
      commentsCountByPost.get(row.id) ?? 0,
      currentUserId,
    ),
  )
}

export async function createMarketplacePost(input: CreateMarketplacePostInput): Promise<MarketplacePost> {
  const title = enforceLength(input.title.trim(), INPUT_LIMITS.marketplace_title, 'Title')
  const description = enforceLength(
    input.description.trim(),
    INPUT_LIMITS.marketplace_description,
    'Description',
  )

  if (title.length < 3) throw new Error('Title must be at least 3 characters.')
  if (description.length < 10) throw new Error('Description must be at least 10 characters.')
  if (!Number.isFinite(input.askingPrice) || input.askingPrice <= 0) {
    throw new Error('Asking price must be greater than 0.')
  }
  if (!input.imageUrl) {
    throw new Error('Please upload an item photo.')
  }

  const { data, error } = await supabaseClient
    .from('marketplace_posts')
    .insert({
      seller_user_id: input.sellerUserId,
      seller_nickname: input.sellerNickname,
      title,
      description,
      asking_price: normalizeMoney(input.askingPrice),
      image_url: input.imageUrl,
      status: 'active',
    })
    .select('*')
    .single()
  throwIfPostgrestError(error)

  return toMarketplacePost(data as MarketplacePostRow, [], 0, input.sellerUserId)
}

export async function updateMarketplacePost(
  postId: string,
  sellerUserId: string,
  input: UpdateMarketplacePostInput,
): Promise<MarketplacePost> {
  const updates: Record<string, unknown> = {}

  if (typeof input.title === 'string') {
    const title = enforceLength(input.title.trim(), INPUT_LIMITS.marketplace_title, 'Title')
    if (title.length < 3) throw new Error('Title must be at least 3 characters.')
    updates.title = title
  }

  if (typeof input.description === 'string') {
    const description = enforceLength(
      input.description.trim(),
      INPUT_LIMITS.marketplace_description,
      'Description',
    )
    if (description.length < 10) throw new Error('Description must be at least 10 characters.')
    updates.description = description
  }

  if (typeof input.askingPrice === 'number') {
    if (!Number.isFinite(input.askingPrice) || input.askingPrice <= 0) {
      throw new Error('Asking price must be greater than 0.')
    }
    updates.asking_price = normalizeMoney(input.askingPrice)
  }

  if (input.imageUrl !== undefined) {
    updates.image_url = input.imageUrl
  }

  if (input.status) {
    updates.status = input.status
  }

  if (Object.keys(updates).length === 0) {
    throw new Error('No changes to save.')
  }

  const { data, error } = await supabaseClient
    .from('marketplace_posts')
    .update(updates)
    .eq('id', postId)
    .eq('seller_user_id', sellerUserId)
    .select('*')
    .maybeSingle()
  throwIfPostgrestError(error)

  if (!data) {
    throw new Error('Unable to update listing. It may have been removed or you do not have permission.')
  }

  return toMarketplacePost(data as MarketplacePostRow, [], 0, sellerUserId)
}

export async function deleteMarketplacePost(postId: string, sellerUserId: string): Promise<void> {
  const { error } = await supabaseClient
    .from('marketplace_posts')
    .delete()
    .eq('id', postId)
    .eq('seller_user_id', sellerUserId)
  throwIfPostgrestError(error)
}

export async function fetchMarketplaceComments(postId: string): Promise<MarketplaceComment[]> {
  const { data, error } = await supabaseClient
    .from('marketplace_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
  throwIfPostgrestError(error)

  return (data ?? []) as MarketplaceCommentRow[]
}

export async function createMarketplaceComment(
  postId: string,
  content: string,
  author: string,
  userId: string,
): Promise<MarketplaceComment> {
  const trimmed = enforceLength(content.trim(), INPUT_LIMITS.marketplace_comment, 'Comment')
  if (trimmed.length < 1) throw new Error('Comment cannot be empty.')

  const { data, error } = await supabaseClient
    .from('marketplace_comments')
    .insert({
      post_id: postId,
      content: trimmed,
      author,
      user_id: userId,
    })
    .select('*')
    .single()
  throwIfPostgrestError(error)

  return data as MarketplaceComment
}

export async function updateMarketplaceComment(
  commentId: string,
  userId: string,
  content: string,
): Promise<void> {
  const trimmed = enforceLength(content.trim(), INPUT_LIMITS.marketplace_comment, 'Comment')
  if (trimmed.length < 1) throw new Error('Comment cannot be empty.')

  const { data, error } = await supabaseClient
    .from('marketplace_comments')
    .update({ content: trimmed })
    .eq('id', commentId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()
  throwIfPostgrestError(error)
  if (!data) {
    throw new Error('Unable to update comment. The comment may be removed or not owned by you.')
  }
}

export async function deleteMarketplaceComment(commentId: string, userId: string): Promise<void> {
  const { error } = await supabaseClient
    .from('marketplace_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId)
  throwIfPostgrestError(error)
}

export async function fetchMarketplaceBids(postId: string): Promise<MarketplaceBid[]> {
  const { data, error } = await supabaseClient
    .from('marketplace_bids')
    .select('id, post_id, bidder_user_id, bidder_nickname, amount, created_at, updated_at')
    .eq('post_id', postId)
    .order('amount', { ascending: false })
    .order('updated_at', { ascending: false })
  throwIfPostgrestError(error)

  return ((data ?? []) as MarketplaceBidRow[]).map(toMarketplaceBid)
}

export async function placeMarketplaceBid(
  postId: string,
  bidderUserId: string,
  bidderNickname: string,
  amount: number,
): Promise<MarketplaceBid> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Bid amount must be greater than 0.')
  }

  const normalizedAmount = normalizeMoney(amount)
  const normalizedNickname = bidderNickname.trim().slice(0, 60) || 'Tenant'

  const { data: existingBid, error: existingError } = await supabaseClient
    .from('marketplace_bids')
    .select('id')
    .eq('post_id', postId)
    .eq('bidder_user_id', bidderUserId)
    .maybeSingle()
  throwIfPostgrestError(existingError)

  if (existingBid?.id) {
    const { data, error } = await supabaseClient
      .from('marketplace_bids')
      .update({
        amount: normalizedAmount,
        bidder_nickname: normalizedNickname,
      })
      .eq('id', existingBid.id)
      .eq('bidder_user_id', bidderUserId)
      .select('id, post_id, bidder_user_id, bidder_nickname, amount, created_at, updated_at')
      .single()
    throwIfPostgrestError(error)
    return toMarketplaceBid(data as MarketplaceBidRow)
  }

  const { data, error } = await supabaseClient
    .from('marketplace_bids')
    .insert({
      post_id: postId,
      bidder_user_id: bidderUserId,
      bidder_nickname: normalizedNickname,
      amount: normalizedAmount,
    })
    .select('id, post_id, bidder_user_id, bidder_nickname, amount, created_at, updated_at')
    .single()
  throwIfPostgrestError(error)

  return toMarketplaceBid(data as MarketplaceBidRow)
}

export async function fetchMarketplaceBidEvents(postId: string): Promise<MarketplaceBidEvent[]> {
  const { data, error } = await supabaseClient
    .from('marketplace_bid_events')
    .select('id, bid_id, post_id, bidder_user_id, bidder_nickname, amount, event_type, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: false })
    .limit(200)
  throwIfPostgrestError(error)

  return ((data ?? []) as MarketplaceBidEventRow[]).map((row) => ({
    id: row.id,
    bid_id: row.bid_id,
    post_id: row.post_id,
    bidder_user_id: row.bidder_user_id,
    bidder_nickname: row.bidder_nickname,
    amount: parseMoney(row.amount),
    event_type: normalizeBidEventType(row.event_type),
    created_at: row.created_at,
  }))
}
