import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL ?? 'https://api.luminalog.com'

// Same-origin proxy, unauthenticated (this IS the pre-sign-in nonce fetch).
export async function GET(_req: NextRequest) {
  try {
    const res = await fetch(`${API_URL}/v1/auth/siws/nonce`, { cache: 'no-store' })
    const body = await res.text()
    return new NextResponse(body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    })
  } catch (err) {
    console.error('[api/auth/siws/nonce] proxy failed', err)
    return NextResponse.json({ error: 'upstream_unreachable' }, { status: 502 })
  }
}
