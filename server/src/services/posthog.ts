import { config, posthogEnabled } from '../config'

/**
 * Server-originated analytics events. Closed list, same rule as the web
 * taxonomy in web/src/lib/analytics/events.ts: adding one means editing this
 * file, which is the point.
 *
 * NEVER add an event or property carrying journal content. These events exist
 * to answer "did the installer activate and pay", nothing else.
 */
export const SERVER_EVENTS = {
  SUBSCRIPTION_STARTED: 'subscription_started',
  TRIAL_STARTED: 'trial_started',
  TRIAL_CONVERTED: 'trial_converted',
  SUBSCRIPTION_RENEWED: 'subscription_renewed',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  SUBSCRIPTION_EXPIRED: 'subscription_expired',
} as const

export type ServerEventName = (typeof SERVER_EVENTS)[keyof typeof SERVER_EVENTS]

/** Only scalars. Objects and arrays are how content leaks into analytics. */
export type ServerEventProps = Record<string, string | number | boolean | null>

/**
 * Short, because analytics is fire-and-forget: a slow vendor must not become a
 * slow webhook. Retries are deliberately absent. A dropped event costs one row
 * in a dashboard; a retry storm against a degraded vendor costs request threads.
 */
const CAPTURE_TIMEOUT_MS = 2000

/**
 * Send one event to PostHog. Never throws, never retries, and returns whether
 * the event actually landed so callers can log without branching on exceptions.
 *
 * `fetchImpl` is injected for testability; production binds the global fetch.
 */
export async function capturePostHog(
  name: ServerEventName,
  distinctId: string,
  props: ServerEventProps = {},
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!posthogEnabled()) return false
  if (!distinctId) return false
  try {
    const res = await fetchImpl(`${config.POSTHOG_API_HOST}/capture/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: config.POSTHOG_PROJECT_API_KEY,
        event: name,
        distinct_id: distinctId,
        properties: {
          ...props,
          // PostHog geolocates from the request IP. From PostHog's side the
          // caller here is the droplet, so the only location this could leak is
          // the server's, but saying so explicitly keeps the guarantee in the
          // code rather than in a deployment detail.
          $ip: null,
          $geoip_disable: true,
        },
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS),
    })
    if (!res.ok) {
      console.warn('[posthog] capture rejected', JSON.stringify({ event: name, status: res.status }))
      return false
    }
    return true
  } catch (e) {
    console.warn('[posthog] capture failed', JSON.stringify({ event: name, error: String(e) }))
    return false
  }
}
