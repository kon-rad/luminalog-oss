import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL ?? 'https://api.luminalog.com'

export async function POST(req: NextRequest, { params }: { params: { classId: string } }) {
  const auth = req.headers.get('authorization')
  if (!auth) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  try {
    const res = await fetch(`${API_URL}/v1/course/${encodeURIComponent(params.classId)}/mint`, {
      method: 'POST',
      headers: { authorization: auth, 'content-type': 'application/json' },
      cache: 'no-store',
    })
    const out = await res.text()
    return new NextResponse(out, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    })
  } catch (err) {
    console.error('[api/course/mint] proxy failed', err)
    return NextResponse.json({ error: 'upstream_unreachable' }, { status: 502 })
  }
}
