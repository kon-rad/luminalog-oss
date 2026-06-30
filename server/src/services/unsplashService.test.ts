import { vi, describe, it, expect, beforeEach } from 'vitest'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)
vi.mock('../config', () => ({ config: { UNSPLASH_ACCESS_KEY: 'k' } }))

import { searchPhoto } from './unsplashService'

const PHOTO = {
  id: 'abc123',
  urls: { regular: 'R', thumb: 'T' },
  user: { name: 'Jane Doe', links: { html: 'https://unsplash.com/@jane' } },
  links: { download_location: 'https://api.unsplash.com/photos/abc123/download' },
}

beforeEach(() => { fetchMock.mockReset() })

describe('searchPhoto', () => {
  it('returns a random photo and fires the download ping', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => PHOTO })
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // download ping
    const photo = await searchPhoto('calm ocean')
    expect(photo).toEqual({
      imageUrl: 'R', imageThumbUrl: 'T',
      photographerName: 'Jane Doe', photographerUrl: 'https://unsplash.com/@jane',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toContain('/photos/random')
    expect(fetchMock.mock.calls[0][0]).toContain('query=calm%20ocean')
  })

  it('falls back to calm landscape when primary query returns nothing', async () => {
    // Primary query: API returns no photo (no id)
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    // Fallback query: returns a photo
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => PHOTO })
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // download ping
    const photo = await searchPhoto('very specific niche term')
    expect(photo).toEqual({
      imageUrl: 'R', imageThumbUrl: 'T',
      photographerName: 'Jane Doe', photographerUrl: 'https://unsplash.com/@jane',
    })
    expect(fetchMock.mock.calls[1][0]).toContain('query=calm%20landscape')
  })

  it('returns null when both primary and fallback return nothing', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })
    expect(await searchPhoto('x')).toBeNull()
  })

  it('returns null on HTTP error', async () => {
    fetchMock.mockResolvedValue({ ok: false })
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
