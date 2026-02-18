type AnalyticsValue = string | number | boolean | null | undefined

export type AnalyticsPayload = Record<string, AnalyticsValue>

export function trackEvent(eventName: string, payload: AnalyticsPayload = {}): void {
  if (!import.meta.env.DEV) return

  // eslint-disable-next-line no-console
  console.info('[analytics]', eventName, payload)
}
