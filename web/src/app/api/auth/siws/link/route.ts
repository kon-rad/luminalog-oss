import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL ?? 'https://api.luminalog.com'

// Same-origin proxy, authenticated: attaches a wallet to the CALLER's already
// signed-in account, so a Firebase ID token must be present and is forwarded
// verbatim (ownership is resolved server-side from it, never from the body).
export async function POST(req: NextRequest) {
  const authorization = req.headers.get('authorization')
  if (!authorization) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  try {
    const res = await fetch(`${API_URL}/v1/auth/siws/link`, {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/json' },
      body: await req.text(),
      cache: 'no-store',
    })
    const body = await res.text()
    return new NextResponse(body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    })
  } catch (err) {
    console.error('[api/auth/siws/link] proxy failed', err)
    return NextResponse.json({ error: 'upstream_unreachable' }, { status: 502 })
  }
}
