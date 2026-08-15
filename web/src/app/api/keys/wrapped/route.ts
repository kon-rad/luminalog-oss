import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL ?? 'https://api.luminalog.com'

// Same-origin proxy for the zero-knowledge wrapped-key store, so the browser
// never calls the API cross-origin (no CORS). Forwards the caller's Firebase ID
// token; ownership is resolved server-side from that token, never from a body.
//
// The bodies passing through here are OPAQUE `{v,iv,ct,tag}` ciphertext
// envelopes. This route never sees, and must never log, key material.

async function proxy(req: NextRequest, method: 'GET' | 'PUT'): Promise<NextResponse> {
  const authorization = req.headers.get('authorization')
  if (!authorization) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const init: RequestInit = {
    method,
    headers: { authorization, 'content-type': 'application/json' },
    cache: 'no-store',
  }
  if (method === 'PUT') init.body = await req.text()

  try {
    const res = await fetch(`${API_URL}/v1/keys/wrapped`, init)
    const body = await res.text()
    return new NextResponse(body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    })
  } catch (err) {
    console.error(`[api/keys/wrapped] ${method} proxy failed`, err)
    return NextResponse.json({ error: 'upstream_unreachable' }, { status: 502 })
  }
}

export async function GET(req: NextRequest) {
  return proxy(req, 'GET')
}

export async function PUT(req: NextRequest) {
  return proxy(req, 'PUT')
}
