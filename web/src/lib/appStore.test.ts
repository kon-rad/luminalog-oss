import { describe, it, expect } from 'vitest'
import { APP_STORE_URL, appStoreUrlFor } from './appStore'

describe('appStoreUrlFor', () => {
  it('returns the plain URL when no campaign is given', () => {
    expect(appStoreUrlFor()).toBe(APP_STORE_URL)
    expect(appStoreUrlFor(null)).toBe(APP_STORE_URL)
  })

  it('returns the plain URL for a slug that fails validation', () => {
    expect(appStoreUrlFor('not a slug')).toBe(APP_STORE_URL)
  })

  it('appends ct and mt for a valid slug', () => {
    const url = new URL(appStoreUrlFor('meta-privacy-founders-v3-202609'))
    expect(url.searchParams.get('ct')).toBe('meta-privacy-founders-v3-202609')
    expect(url.searchParams.get('mt')).toBe('8')
  })

  it('preserves the App Store path and app id', () => {
    const url = new URL(appStoreUrlFor('yt-journaling-howto-v1-202609'))
    expect(url.hostname).toBe('apps.apple.com')
    expect(url.pathname).toContain('id6781137459')
  })

  it('does not append pt when no provider token is configured', () => {
    const url = new URL(appStoreUrlFor('meta-privacy-founders-v3-202609'))
    if (!process.env.NEXT_PUBLIC_APPLE_PROVIDER_TOKEN) {
      expect(url.searchParams.get('pt')).toBeNull()
    }
  })
})
