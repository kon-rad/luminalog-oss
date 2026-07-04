import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL ?? 'https://api.luminalog.com'

// Force dynamic rendering — this is a streaming proxy, never statically
// optimized/cached by Next.
export const dynamic = 'force-dynamic'

// Same-origin SSE proxy so the browser never calls the API cross-origin (no
// CORS). Forwards the caller's Firebase ID token + JSON body to the backend's
// authed streaming `/v1/ai/chat` (design §1) and passes the `text/event-stream`
// response body straight through, unbuffered — the chat doc must already
// exist client-side; the server persists both messages + streams deltas.
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  try {
    const body = await req.text()
    const upstream = await fetch(`${API_URL}/v1/ai/chat`, {
      method: 'POST',
      headers: { authorization: auth, 'content-type': 'application/json', accept: 'text/event-stream' },
      body,
      cache: 'no-store',
    })

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
      },
    })
  } catch (err) {
    console.error('[api/ai/chat] proxy failed', err)
    return NextResponse.json({ error: 'upstream_unreachable' }, { status: 502 })
  }
}
