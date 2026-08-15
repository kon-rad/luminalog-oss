import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls: { path: string; body?: unknown }[] = []
let getResponse: unknown = { wrappedKeys: {}, zkKeyVersion: null }
let putShouldThrow = false

vi.mock('@/lib/api/client', () => ({
  apiGet: async (path: string) => {
    calls.push({ path })
    return getResponse
  },
  apiPut: async (path: string, body: unknown) => {
    calls.push({ path, body })
    if (putShouldThrow) throw new Error('api PUT /api/keys/wrapped failed: 400 bad')
    return { ok: true }
  },
}))

const { fetchWraps, uploadWraps } = await import('./wrapTransport')

// A structurally valid envelope: 12-byte iv, non-empty ct, 16-byte tag.
const ENV = {
  v: 1 as const,
  iv: Buffer.alloc(12).toString('base64'),
  ct: Buffer.alloc(32).toString('base64'),
  tag: Buffer.alloc(16).toString('base64'),
}

beforeEach(() => {
  calls.length = 0
  putShouldThrow = false
  getResponse = { wrappedKeys: {}, zkKeyVersion: null }
})

describe('fetchWraps', () => {
  it('calls the same-origin proxy', async () => {
    await fetchWraps()
    expect(calls[0].path).toBe('/api/keys/wrapped')
  })

  it('returns an empty map when the user has no wraps', async () => {
    const got = await fetchWraps()
    expect(got.wrappedKeys).toEqual({})
    expect(got.zkKeyVersion).toBeNull()
  })

  it('keeps only well-formed envelopes under known methods', async () => {
    getResponse = {
      wrappedKeys: {
        recovery: ENV,
        icloud: { v: 1, iv: 'x' }, // malformed, dropped
        bogus: ENV, // unknown method, dropped
      },
      zkKeyVersion: 1,
    }
    const got = await fetchWraps()
    expect(Object.keys(got.wrappedKeys)).toEqual(['recovery'])
    expect(got.zkKeyVersion).toBe(1)
  })

  it('tolerates a missing wrappedKeys field', async () => {
    getResponse = {}
    const got = await fetchWraps()
    expect(got.wrappedKeys).toEqual({})
  })

  it('tolerates an array or null in place of the map', async () => {
    getResponse = { wrappedKeys: [] }
    expect((await fetchWraps()).wrappedKeys).toEqual({})
    getResponse = { wrappedKeys: null }
    expect((await fetchWraps()).wrappedKeys).toEqual({})
  })
})

describe('uploadWraps', () => {
  it('PUTs the envelopes with a default keyVersion of 1', async () => {
    await uploadWraps({ recovery: ENV })
    expect(calls[0].path).toBe('/api/keys/wrapped')
    expect(calls[0].body).toEqual({ wraps: { recovery: ENV }, keyVersion: 1 })
  })

  it('refuses to upload an empty map rather than issuing a doomed request', async () => {
    await expect(uploadWraps({})).rejects.toThrow(/at least one/i)
    expect(calls).toHaveLength(0)
  })

  it('propagates a server rejection', async () => {
    putShouldThrow = true
    await expect(uploadWraps({ recovery: ENV })).rejects.toThrow(/400/)
  })
})
