import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL ?? 'https://api.luminalog.com'

// Same-origin proxy for saving a recorded answer. The upstream fetches the
// already-uploaded object from S3, transcribes it, and writes the answer with
// attribution taken from the verified token. Transcription can take a while on
// a long answer, so this route must not be edge-cached or short-circuited.
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(req: NextRequest, { params }: { params: { code: string } }) {
  const auth = req.headers.get('authorization')
  if (!auth) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const code = encodeURIComponent(params.code)
  try {
    const body = await req.text()
    const res = await fetch(`${API_URL}/v1/cardgame/rooms/${code}/answers`, {
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
    console.error('[api/cardgame/answers] proxy failed', err)
    return NextResponse.json({ error: 'upstream_unreachable' }, { status: 502 })
  }
}
