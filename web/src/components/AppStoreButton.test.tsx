// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireAppStoreClick, appStoreHrefForSession } from './AppStoreButton'
import { APP_STORE_URL } from '@/lib/appStore'
import { EVENTS } from '@/lib/analytics/events'
import { ATTRIBUTION_STORAGE_KEY } from '@/lib/analytics/attribution'

const CAMPAIGN = 'meta-privacy-founders-v3-202609'

beforeEach(() => {
  window.sessionStorage.clear()
})

describe('fireAppStoreClick', () => {
  it('sends the primary conversion over beacon transport', () => {
    // THE test for the beacon hazard. Firing a normal request and immediately
    // navigating to Apple drops it in most browsers, which would make
    // app_store_click undercount inconsistently while still looking plausible.
    const trackFn = vi.fn()
    fireAppStoreClick(trackFn as any)
    expect(trackFn).toHaveBeenCalledWith(EVENTS.APP_STORE_CLICK, {}, { beacon: true })
  })

  it('never throws into the click handler, so navigation always happens', () => {
    const exploding = vi.fn(() => { throw new Error('analytics is down') })
    expect(() => fireAppStoreClick(exploding as any)).not.toThrow()
  })
})

describe('appStoreHrefForSession', () => {
  it('carries the persisted campaign into Apple as a ct token', () => {
    window.sessionStorage.setItem(
      ATTRIBUTION_STORAGE_KEY,
      JSON.stringify({ campaign: CAMPAIGN, source: 'facebook', medium: 'paid', fbclid: null, gclid: null }),
    )
    const href = appStoreHrefForSession(window.sessionStorage)
    expect(href).toContain(`ct=${CAMPAIGN}`)
    expect(href).toContain('mt=8')
  })

  it('falls back to the plain listing for untagged traffic', () => {
    expect(appStoreHrefForSession(window.sessionStorage)).toBe(APP_STORE_URL)
  })

  it('does not throw when storage is unavailable', () => {
    const hostile = {
      getItem() { throw new Error('blocked') },
      setItem() { throw new Error('blocked') },
    } as unknown as Storage
    expect(() => appStoreHrefForSession(hostile)).not.toThrow()
  })
})
