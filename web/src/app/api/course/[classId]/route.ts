import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL ?? 'https://api.luminalog.com'

export async function GET(req: NextRequest, { params }: { params: { classId: string } }) {
  const auth = req.headers.get('authorization')
  if (!auth) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  try {
    const res = await fetch(`${API_URL}/v1/course/${encodeURIComponent(params.classId)}`, {
      headers: { authorization: auth },
      cache: 'no-store',
    })
    const body = await res.text()
    return new NextResponse(body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    })
  } catch (err) {
    console.error('[api/course] proxy failed', err)
    return NextResponse.json({ error: 'upstream_unreachable' }, { status: 502 })
  }
}
