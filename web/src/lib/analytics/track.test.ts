import { describe, it, expect } from 'vitest'
import { buildEventPayload } from './track'
import { EVENTS } from './events'
import type { Attribution } from './attribution'

const ATTR: Attribution = {
  campaign: 'meta-privacy-founders-v3-202609',
  source: 'facebook',
  medium: 'paid',
  fbclid: 'abc123',
  gclid: null,
}

describe('buildEventPayload', () => {
  it('stamps the campaign onto every event', () => {
    const payload = buildEventPayload(EVENTS.APP_STORE_CLICK, {}, ATTR)
    expect(payload.campaign).toBe('meta-privacy-founders-v3-202609')
    expect(payload.source).toBe('facebook')
    expect(payload.medium).toBe('paid')
  })

  it('uses null rather than omitting the campaign for untagged traffic', () => {
    const payload = buildEventPayload(EVENTS.PAGE_VIEW, {}, {
      campaign: null,
      source: null,
      medium: null,
      fbclid: null,
      gclid: null,
    })
    expect(payload.campaign).toBeNull()
  })

  it('keeps caller props but never lets them overwrite the campaign', () => {
    const payload = buildEventPayload(EVENTS.PAGE_VIEW, { path: '/', campaign: 'spoofed' }, ATTR)
    expect(payload.path).toBe('/')
    expect(payload.campaign).toBe('meta-privacy-founders-v3-202609')
  })

  it('never carries click ids into the analytics payload', () => {
    const payload = buildEventPayload(EVENTS.PAGE_VIEW, {}, ATTR)
    expect(payload.fbclid).toBeUndefined()
    expect(payload.gclid).toBeUndefined()
  })
})
