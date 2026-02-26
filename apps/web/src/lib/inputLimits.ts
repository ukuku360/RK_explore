export const INPUT_LIMITS = {
  /** Post location / title */
  location: 200,
  /** Post prep notes */
  prep_notes: 2000,
  /** Post meetup place */
  meetup_place: 200,
  /** Post meeting time */
  meeting_time: 100,
  /** Feed post comment */
  comment: 2000,
  /** Community post body */
  community_post: 2000,
  /** Community comment */
  community_comment: 500,
  /** Marketplace listing title */
  marketplace_title: 120,
  /** Marketplace listing description */
  marketplace_description: 2000,
  /** Marketplace comment */
  marketplace_comment: 500,
  /** Marketplace direct message */
  marketplace_chat_message: 1000,
} as const

export function enforceLength(value: string, limit: number, fieldName: string): string {
  if (value.length > limit) {
    throw new Error(`${fieldName} must be ${limit} characters or fewer.`)
  }
  return value
}
