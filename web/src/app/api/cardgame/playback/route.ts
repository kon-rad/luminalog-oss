import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL ?? 'https://api.luminalog.com'

// Same-origin proxy for signed playback URLs. Deliberately NOT authenticated:
// the card games are public, so a signed-out visitor must be able to hear the
// answers. The upstream refuses any key outside the public/cardgame/ prefix,
// which is what keeps "public" from meaning "the whole bucket".
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const res = await fetch(`${API_URL}/v1/cardgame/playback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      cache: 'no-store',
    })
    const resBody = await res.text()
    return new NextResponse(resBody, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    })
  } catch (err) {
    console.error('[api/cardgame/playback] proxy failed', err)
    return NextResponse.json({ error: 'upstream_unreachable' }, { status: 502 })
  }
}
