import { describe, it, expect, vi, beforeEach } from 'vitest'

const getIdToken = vi.fn()

vi.mock('../firebase', () => ({
  auth: {
    get currentUser() {
      return { getIdToken }
    },
  },
}))

import { apiPost } from './client'

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

    const result = await apiPost<{ dek: string }>('/api/keys/bootstrap', {})

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

    await expect(apiPost('/api/keys/bootstrap', {})).rejects.toThrow(/401/)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
