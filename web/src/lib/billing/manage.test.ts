import { describe, it, expect } from 'vitest'
import { manageDestination } from './manage'

describe('manageDestination', () => {
  it('sends a non-subscriber to the upgrade path', () => {
    expect(manageDestination('inactive', 'unknown', null)).toEqual({ kind: 'upgrade' })
    expect(manageDestination('loading', 'rc_billing', 'https://pay.rev.cat/x')).toEqual({
      kind: 'upgrade',
    })
  })

  it('never opens a URL for an App Store subscription', () => {
    // Apple's own management URL is present here and must still be ignored: a
    // browser cannot cancel an App Store subscription.
    expect(
      manageDestination('active', 'app_store', 'https://apps.apple.com/account/subscriptions'),
    ).toEqual({ kind: 'appStore' })
    expect(manageDestination('active', 'mac_app_store', null)).toEqual({ kind: 'appStore' })
  })

  it('opens the customer portal for a web-billed subscription', () => {
    expect(manageDestination('active', 'rc_billing', 'https://pay.rev.cat/portal/abc')).toEqual({
      kind: 'portal',
      url: 'https://pay.rev.cat/portal/abc',
    })
    expect(manageDestination('active', 'stripe', 'https://billing.stripe.com/p/session')).toEqual({
      kind: 'portal',
      url: 'https://billing.stripe.com/p/session',
    })
  })

  it('says so when a granted plan has no billing to manage', () => {
    expect(manageDestination('active', 'promotional', null)).toEqual({ kind: 'notManageable' })
  })

  it('does not fall back to a store page when the URL is missing', () => {
    // The case the routing exists for: no URL and a non-Apple store must not
    // become "open Apple's subscriptions page".
    expect(manageDestination('active', 'rc_billing', null)).toEqual({ kind: 'notManageable' })
    expect(manageDestination('active', 'unknown', null)).toEqual({ kind: 'notManageable' })
  })
})
