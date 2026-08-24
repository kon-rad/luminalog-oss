import { Router, Request, Response } from 'express'
import { config, posthogEnabled } from '../config'

export const analyticsRouter = Router()

/**
 * PostHog ingestion reverse proxy, mounted at `/v1/ph`.
 *
 * This route is the entire reason the iOS app can carry product analytics with
 * `NSPrivacyTracking = false` and an EMPTY `NSPrivacyTrackingDomains`, and
 * therefore with no App Tracking Transparency prompt: the binary's only network
 * peer stays api.luminalog.com. Pointing the iOS SDK straight at PostHog would
 * put a tracking domain in the privacy manifest and change the app's App Store
 * privacy label. Do not "simplify" this away.
 *
 * Public on purpose (no `firebaseAuth`): the SDK authenticates with the PostHog
 * project API key in the body, not with a Firebase token, and the payload
 * carries no journal content. The path allowlist below is what keeps a public
 * unauthenticated forwarder from being useful to anyone else.
 *
 * Additive to the shipped v1.0 client contract: v1.0 installs never call this.
 */

/**
 * The ingestion paths the PostHog web and Swift SDKs actually use. An
 * allowlist rather than a passthrough, so this cannot be turned into a general
 * relay by anyone who finds the URL.
 */
const ALLOWED_PATHS = new Set([
  '/capture/',
  '/batch/',
  '/decide/',
  '/e/',
  '/i/v0/e/',
  '/flags/',
])

/** Short: a slow vendor must not hold a request thread on a shared droplet. */
const PROXY_TIMEOUT_MS = 3000

export function sanitizeProxyPath(raw: string): string | null {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return null
  const withSlash = raw.endsWith('/') ? raw : `${raw}/`
  return ALLOWED_PATHS.has(withSlash) ? withSlash : null
}

function scrubOne(event: Record<string, unknown>): Record<string, unknown> {
  const properties = (event?.properties ?? {}) as Record<string, unknown>
  return {
    ...event,
    // Set last, so a client cannot supply its own $ip and win.
    properties: { ...properties, $ip: null, $geoip_disable: true },
  }
}

/**
 * Strip location signal from a payload before it leaves our infrastructure.
 * This costs the country breakdown on iOS, deliberately: the alternative is
 * that the server becomes the component that hands user locations to a vendor,
 * which is not a trade this product makes.
 */
export function stripClientIp(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { properties: { $ip: null, $geoip_disable: true } }
  }
  const payload = body as Record<string, unknown>
  if (Array.isArray(payload.batch)) {
    return {
      ...payload,
      batch: (payload.batch as Record<string, unknown>[]).map(scrubOne),
    }
  }
  return scrubOne(payload)
}

export async function posthogProxyHandler(
  req: Request,
  res: Response,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  // Unconfigured is a clean no-op, not an error: the deploy and the .env edit
  // can land in either order without a window of 500s.
  if (!posthogEnabled()) {
    res.status(202).json({ status: 1 })
    return
  }

  const path = sanitizeProxyPath(req.path)
  if (!path) {
    res.status(404).json({ error: 'not_found' })
    return
  }

  try {
    // Headers are built from scratch rather than forwarded. Passing the
    // client's headers through would hand PostHog an X-Forwarded-For and undo
    // the whole point of stripClientIp.
    const upstream = await fetchImpl(`${config.POSTHOG_API_HOST}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(stripClientIp(req.body)),
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    })
    if (!upstream.ok) {
      console.warn('[analytics/proxy] upstream rejected', JSON.stringify({ path, status: upstream.status }))
    }
  } catch (e) {
    console.warn('[analytics/proxy] upstream unreachable', JSON.stringify({ path, error: String(e) }))
  }

  // Always 202. The client is an analytics SDK: a non-2xx makes it retry and
  // queue, which turns a vendor outage into a client-side retry storm against
  // our own API. Accepting and dropping is the correct failure mode here.
  res.status(202).json({ status: 1 })
}

analyticsRouter.post('/*', (req: Request, res: Response) => posthogProxyHandler(req, res))
