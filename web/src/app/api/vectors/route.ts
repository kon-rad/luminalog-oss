import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL ?? 'https://api.luminalog.com'

// Same-origin proxy for the zero-knowledge encrypted-vector blob store so the
// browser never calls the API cross-origin (no CORS). Forwards the caller's
// Firebase ID token. The server stores/returns opaque ciphertext blobs verbatim
// — it never decrypts them. GET lists the caller's blobs; POST bulk-upserts to
// the backend's /v1/vectors/batch.

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  try {
    const res = await fetch(`${API_URL}/v1/vectors`, {
      method: 'GET',
      headers: { authorization: auth },
      cache: 'no-store',
    })
    const body = await res.text()
    return new NextResponse(body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    })
  } catch (err) {
    console.error('[api/vectors] GET proxy failed', err)
    return NextResponse.json({ error: 'upstream_unreachable' }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  try {
    const body = await req.text()
    const res = await fetch(`${API_URL}/v1/vectors/batch`, {
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
    console.error('[api/vectors] POST proxy failed', err)
    return NextResponse.json({ error: 'upstream_unreachable' }, { status: 502 })
  }
}
