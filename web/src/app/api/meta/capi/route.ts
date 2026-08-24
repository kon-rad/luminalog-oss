import { NextRequest } from 'next/server'
import { buildUserData } from '@/lib/analytics/metaCapi'

/**
 * Meta Conversions API relay.
 *
 * Server-side events reach Meta even when a browser blocks the Pixel, which is
 * a large share of traffic. The browser and this route send the SAME `event_id`
 * so Meta collapses the pair into one event. Without that shared id every
 * conversion double-counts, which quietly halves every reported cost metric.
 *
 * Email is SHA-256 hashed here, on the server, and never leaves in plain text.
 */

export const runtime = 'nodejs'

const GRAPH_VERSION = 'v21.0'

export async function POST(req: NextRequest): Promise<Response> {
  const pixelId = process.env.META_PIXEL_ID
  const token = process.env.META_CAPI_ACCESS_TOKEN
  // No credentials means the relay is not configured yet. Succeed quietly so
  // the browser never sees an error from an analytics call.
  if (!pixelId || !token) return Response.json({ ok: true, skipped: true })

  let body: {
    eventId?: string
    eventName?: string
    eventSourceUrl?: string
    email?: string | null
    fbc?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false }, { status: 400 })
  }

  if (!body.eventId || !body.eventName) return Response.json({ ok: false }, { status: 400 })

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null
  const userAgent = req.headers.get('user-agent')
  const fbp = req.cookies.get('_fbp')?.value ?? null
  const fbc = body.fbc ?? req.cookies.get('_fbc')?.value ?? null

  const userData = await buildUserData({
    email: body.email ?? null,
    ip,
    userAgent,
    fbp,
    fbc,
  })

  const payload = {
    data: [
      {
        event_name: body.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: body.eventId,
        event_source_url: body.eventSourceUrl,
        action_source: 'website',
        user_data: userData,
      },
    ],
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)
    await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${token}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      },
    )
    clearTimeout(timer)
  } catch {
    // Short timeout, no retries. A dropped server event still has the browser
    // Pixel event as its counterpart, and dedup makes the loss invisible.
  }

  return Response.json({ ok: true })
}
