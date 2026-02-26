import type { MarketplaceChatMessage, MarketplaceChatThread } from '../../types/domain'
import { enforceLength, INPUT_LIMITS } from '../../lib/inputLimits'
import { supabaseClient } from '../supabase/client'
import { throwIfPostgrestError } from '../supabase/errors'

type MarketplaceChatThreadRow = MarketplaceChatThread
type MarketplaceChatMessageRow = MarketplaceChatMessage

type GetOrCreateThreadInput = {
  currentUserId: string
  postId: string
  postTitle: string
  postImageUrl: string | null
  sellerUserId: string
  sellerNickname: string
  buyerUserId: string
  buyerNickname: string
}

type SendMarketplaceChatMessageInput = {
  threadId: string
  senderUserId: string
  senderNickname: string
  content: string
}

export async function listMarketplaceChatThreads(
  viewerUserId: string,
  isAdmin: boolean,
): Promise<MarketplaceChatThread[]> {
  const query = supabaseClient
    .from('marketplace_chat_threads')
    .select('*')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(200)

  const filteredQuery = isAdmin
    ? query
    : query.or(`seller_user_id.eq.${viewerUserId},buyer_user_id.eq.${viewerUserId}`)

  const { data, error } = await filteredQuery
  throwIfPostgrestError(error)

  return (data ?? []) as MarketplaceChatThreadRow[]
}

export async function getOrCreateMarketplaceChatThread(
  input: GetOrCreateThreadInput,
): Promise<MarketplaceChatThread> {
  if (
    input.currentUserId !== input.sellerUserId &&
    input.currentUserId !== input.buyerUserId
  ) {
    throw new Error('Only participants can open a chat thread.')
  }

  if (input.sellerUserId === input.buyerUserId) {
    throw new Error('Cannot create a private chat with yourself.')
  }

  const { data: existingThread, error: existingError } = await supabaseClient
    .from('marketplace_chat_threads')
    .select('*')
    .eq('post_id', input.postId)
    .eq('buyer_user_id', input.buyerUserId)
    .maybeSingle()
  throwIfPostgrestError(existingError)

  if (existingThread) {
    return existingThread as MarketplaceChatThreadRow
  }

  const { data, error } = await supabaseClient
    .from('marketplace_chat_threads')
    .insert({
      post_id: input.postId,
      post_title: input.postTitle,
      post_image_url: input.postImageUrl,
      seller_user_id: input.sellerUserId,
      seller_nickname: input.sellerNickname,
      buyer_user_id: input.buyerUserId,
      buyer_nickname: input.buyerNickname,
    })
    .select('*')
    .single()
  throwIfPostgrestError(error)

  return data as MarketplaceChatThread
}

export async function listMarketplaceChatMessages(threadId: string): Promise<MarketplaceChatMessage[]> {
  const { data, error } = await supabaseClient
    .from('marketplace_chat_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(400)
  throwIfPostgrestError(error)

  return (data ?? []) as MarketplaceChatMessageRow[]
}

export async function sendMarketplaceChatMessage(
  input: SendMarketplaceChatMessageInput,
): Promise<MarketplaceChatMessage> {
  const content = enforceLength(
    input.content.trim(),
    INPUT_LIMITS.marketplace_chat_message,
    'Message',
  )
  if (content.length < 1) {
    throw new Error('Message cannot be empty.')
  }

  const senderNickname = input.senderNickname.trim().slice(0, 60) || 'Tenant'

  const { data, error } = await supabaseClient
    .from('marketplace_chat_messages')
    .insert({
      thread_id: input.threadId,
      sender_user_id: input.senderUserId,
      sender_nickname: senderNickname,
      content,
    })
    .select('*')
    .single()
  throwIfPostgrestError(error)

  return data as MarketplaceChatMessage
}
