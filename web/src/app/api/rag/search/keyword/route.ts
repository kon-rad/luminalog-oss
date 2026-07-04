import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL ?? 'https://api.luminalog.com'

// Same-origin proxy so the browser never calls the API cross-origin (no CORS).
// Forwards the caller's Firebase ID token + JSON body to the backend's authed
// /v1/rag/search/keyword (design §2) — server-decrypted substring search.
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  try {
    const body = await req.text()
    const res = await fetch(`${API_URL}/v1/rag/search/keyword`, {
      method: 'POST',
      headers: { authorization: auth, 'content-type': 'application/json' },
      body,
      cache: 'no-store',
    })
    const resBody = await res.text()
    return new NextResponse(resBody, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    })
  } catch (err) {
    console.error('[api/rag/search/keyword] proxy failed', err)
    return NextResponse.json({ error: 'upstream_unreachable' }, { status: 502 })
  }
}
