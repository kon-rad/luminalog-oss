import { describe, it, expect, vi, beforeEach } from 'vitest'

const getIdToken = vi.fn()

vi.mock('../firebase', () => ({
  auth: {
    get currentUser() {
      return { getIdToken }
    },
  },
}))

import { apiPost, ProRequiredError, isProRequired } from './client'

describe('apiPost 401 retry', () => {
  beforeEach(() => {
    getIdToken.mockReset()
    vi.unstubAllGlobals()
  })

  it('force-refreshes the token and retries once on a 401, resolving with the retried body', async () => {
    getIdToken.mockResolvedValueOnce('stale-token').mockResolvedValueOnce('fresh-token')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ dek: 'ok' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await apiPost<{ dek: string }>('/api/keys/wrapped', {})

    expect(result).toEqual({ dek: 'ok' })
    expect(getIdToken).toHaveBeenNthCalledWith(1, false)
    expect(getIdToken).toHaveBeenNthCalledWith(2, true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws when the retried request is still non-2xx', async () => {
    getIdToken.mockResolvedValue('token')
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiPost('/api/keys/wrapped', {})).rejects.toThrow(/401/)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('apiPost 402 -> ProRequiredError', () => {
  beforeEach(() => {
    getIdToken.mockReset()
    vi.unstubAllGlobals()
  })

  it('throws a typed ProRequiredError so callers can open the upgrade modal', async () => {
    getIdToken.mockResolvedValue('token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'pro_required' }), { status: 402 }),
    ))

    await expect(apiPost('/api/ai/summary', {})).rejects.toBeInstanceOf(ProRequiredError)
  })

  it('does not retry a 402: paying is the fix, a fresh token is not', async () => {
    getIdToken.mockResolvedValue('token')
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'pro_required' }), { status: 402 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiPost('/api/ai/summary', {})).rejects.toBeInstanceOf(ProRequiredError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('leaves other non-2xx failures as plain Errors', async () => {
    getIdToken.mockResolvedValue('token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'boom' }), { status: 500 }),
    ))

    const err = await apiPost('/api/ai/summary', {}).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err).not.toBeInstanceOf(ProRequiredError)
  })

  it('isProRequired recognizes the error across the module boundary', async () => {
    getIdToken.mockResolvedValue('token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'pro_required' }), { status: 402 }),
    ))

    const err = await apiPost('/api/ai/summary', {}).catch((e) => e)
    expect(isProRequired(err)).toBe(true)
    expect(isProRequired(new Error('nope'))).toBe(false)
  })
})
