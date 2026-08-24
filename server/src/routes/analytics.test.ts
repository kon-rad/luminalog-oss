import { vi, describe, it, expect, beforeEach } from 'vitest'

const { cfg, state } = vi.hoisted(() => ({
  cfg: { POSTHOG_API_HOST: 'https://ph.example.com' } as Record<string, string | undefined>,
  state: { enabled: true },
}))

vi.mock('../config', () => ({
  config: cfg,
  posthogEnabled: () => state.enabled,
}))

import { sanitizeProxyPath, stripClientIp, posthogProxyHandler } from './analytics'

function mockRes() {
  const res: any = { statusCode: 200 }
  res.status = vi.fn((c: number) => { res.statusCode = c; return res })
  res.json = vi.fn((b: any) => { res.body = b; return res })
  return res
}

describe('sanitizeProxyPath', () => {
  it('allows the PostHog ingestion paths the SDKs actually use', () => {
    expect(sanitizeProxyPath('/capture/')).toBe('/capture/')
    expect(sanitizeProxyPath('/batch/')).toBe('/batch/')
    expect(sanitizeProxyPath('/decide/')).toBe('/decide/')
  })

  it('tolerates a missing trailing slash', () => {
    expect(sanitizeProxyPath('/capture')).toBe('/capture/')
  })

  it('refuses anything outside the allowlist, so this is not an open relay', () => {
    expect(sanitizeProxyPath('/admin/')).toBeNull()
    expect(sanitizeProxyPath('/../../etc/passwd')).toBeNull()
    expect(sanitizeProxyPath('/')).toBeNull()
  })
})

describe('stripClientIp', () => {
  it('nulls the ip and disables geoip on a single event', () => {
    const out = stripClientIp({ event: 'app_opened', properties: { kind: 'text' } }) as any
    expect(out.properties.kind).toBe('text')
    expect(out.properties.$ip).toBeNull()
    expect(out.properties.$geoip_disable).toBe(true)
  })

  it('scrubs every event in a batch', () => {
    const out = stripClientIp({ batch: [{ event: 'a' }, { event: 'b', properties: { x: 1 } }] }) as any
    expect(out.batch).toHaveLength(2)
    for (const e of out.batch) {
      expect(e.properties.$ip).toBeNull()
      expect(e.properties.$geoip_disable).toBe(true)
    }
    expect(out.batch[1].properties.x).toBe(1)
  })

  it('overrides an ip the client tried to supply itself', () => {
    const out = stripClientIp({ event: 'a', properties: { $ip: '203.0.113.9' } }) as any
    expect(out.properties.$ip).toBeNull()
  })

  it('does not throw on junk', () => {
    expect(() => stripClientIp(undefined)).not.toThrow()
    expect(() => stripClientIp('nonsense')).not.toThrow()
  })
})

describe('posthogProxyHandler', () => {
  beforeEach(() => { state.enabled = true })

  it('accepts and drops without a network call when PostHog is unconfigured', async () => {
    state.enabled = false
    const f = vi.fn()
    const res = mockRes()
    await posthogProxyHandler({ path: '/capture/', body: { event: 'a' } } as any, res, f as any)
    expect(res.statusCode).toBe(202)
    expect(f).not.toHaveBeenCalled()
  })

  it('forwards to the upstream capture path', async () => {
    const f = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => ({ ok: true, status: 200 }) as any)
    const res = mockRes()
    await posthogProxyHandler({ path: '/capture/', body: { event: 'a' } } as any, res, f)
    expect(f.mock.calls[0][0]).toBe('https://ph.example.com/capture/')
    expect(res.statusCode).toBe(202)
  })

  it('never forwards a client ip header', async () => {
    const f = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => ({ ok: true, status: 200 }) as any)
    const res = mockRes()
    await posthogProxyHandler(
      { path: '/capture/', body: { event: 'a' }, headers: { 'x-forwarded-for': '203.0.113.9' } } as any,
      res,
      f,
    )
    const headers = (f.mock.calls[0][1] as any).headers
    expect(Object.keys(headers).map((k) => k.toLowerCase())).toEqual(['content-type'])
  })

  it('404s a path outside the allowlist', async () => {
    const f = vi.fn()
    const res = mockRes()
    await posthogProxyHandler({ path: '/admin/', body: {} } as any, res, f as any)
    expect(res.statusCode).toBe(404)
    expect(f).not.toHaveBeenCalled()
  })

  it('still 202s when the upstream is unreachable, so a vendor outage is not our outage', async () => {
    const f = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => { throw new Error('unreachable') })
    const res = mockRes()
    await posthogProxyHandler({ path: '/capture/', body: { event: 'a' } } as any, res, f as any)
    expect(res.statusCode).toBe(202)
  })
})
