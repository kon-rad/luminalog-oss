import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL ?? 'https://api.luminalog.com'

// Same-origin proxy, unauthenticated: this IS how the caller becomes
// signed-in, so there is no Firebase token to forward yet.
export async function POST(req: NextRequest) {
  try {
    const res = await fetch(`${API_URL}/v1/auth/siws/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: await req.text(),
      cache: 'no-store',
    })
    const body = await res.text()
    return new NextResponse(body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    })
  } catch (err) {
    console.error('[api/auth/siws/verify] proxy failed', err)
    return NextResponse.json({ error: 'upstream_unreachable' }, { status: 502 })
  }
}
