import { vi, describe, it, expect, beforeEach } from 'vitest'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)
vi.mock('../config', () => ({ config: { UNSPLASH_ACCESS_KEY: 'k' } }))

import { searchPhoto } from './unsplashService'

beforeEach(() => { fetchMock.mockReset() })

describe('searchPhoto', () => {
  it('maps the first result and fires the download ping', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{
      urls: { regular: 'R', thumb: 'T' },
      user: { name: 'Jane Doe', links: { html: 'https://unsplash.com/@jane' } },
      links: { download_location: 'https://api.unsplash.com/photos/x/download' },
    }] }) })
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // download ping
    const photo = await searchPhoto('calm ocean horizon')
    expect(photo).toEqual({
      imageUrl: 'R', imageThumbUrl: 'T',
      photographerName: 'Jane Doe', photographerUrl: 'https://unsplash.com/@jane',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns null on empty results', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
    expect(await searchPhoto('x')).toBeNull()
  })
})

describe('searchPhoto without a key', () => {
  it('returns null and does not call fetch', async () => {
    vi.resetModules()
    vi.doMock('../config', () => ({ config: { UNSPLASH_ACCESS_KEY: undefined } }))
    const { searchPhoto: sp } = await import('./unsplashService')
    expect(await sp('x')).toBeNull()
  })
})
