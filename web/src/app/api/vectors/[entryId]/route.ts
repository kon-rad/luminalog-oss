import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL ?? 'https://api.luminalog.com'

// Same-origin proxy: delete one entry's opaque vector blob → backend
// DELETE /v1/vectors/:entryId. Ownership is enforced server-side from the token.
export async function DELETE(req: NextRequest, { params }: { params: { entryId: string } }) {
  const auth = req.headers.get('authorization')
  if (!auth) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  try {
    const res = await fetch(`${API_URL}/v1/vectors/${encodeURIComponent(params.entryId)}`, {
      method: 'DELETE',
      headers: { authorization: auth },
      cache: 'no-store',
    })
    const body = await res.text()
    return new NextResponse(body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    })
  } catch (err) {
    console.error('[api/vectors/:entryId] DELETE proxy failed', err)
    return NextResponse.json({ error: 'upstream_unreachable' }, { status: 502 })
  }
}
