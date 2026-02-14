type AnalyticsValue = string | number | boolean | null | undefined

export type AnalyticsPayload = Record<string, AnalyticsValue>

export function trackEvent(eventName: string, payload: AnalyticsPayload = {}): void {
  if (!import.meta.env.DEV) return

  console.info('[analytics]', eventName, payload)
}
