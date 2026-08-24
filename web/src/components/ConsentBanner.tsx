'use client'

import { useEffect, useState } from 'react'
import { readConsent, writeConsent } from '@/lib/analytics/consent'
import { initMetaPixel } from '@/lib/analytics/meta'
import { initGoogleTag } from '@/lib/analytics/google'

/**
 * Shown to every visitor, deliberately. Geo-detecting who legally requires a
 * banner was rejected: the droplet has no geo header, GeoIP in nginx is not
 * worth the complexity, and a banner that should be shown honestly should be
 * shown to everyone.
 *
 * Only Meta and Google are gated here. PostHog runs regardless, which is
 * defensible only because of how it is configured (cookieless, no autocapture,
 * proxied, storing nothing on the device). The consequence that matters: the
 * number that decides whether a creative worked, landing visit to App Store tap
 * by campaign, survives a decline.
 *
 * Consent goes to localStorage, not sessionStorage: a decision this explicit
 * should not have to be made again on the visitor's next tab.
 */
export default function ConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      setVisible(readConsent(window.localStorage) === 'unknown')
    } catch {
      // Storage blocked (private mode, embedded browser). Ask nothing and load
      // nothing: an unanswerable banner is worse than no advertising signal.
    }
  }, [])

  if (!visible) return null

  function decide(state: 'granted' | 'denied') {
    try {
      writeConsent(window.localStorage, state)
    } catch {
      // Best effort. The tags below are still gated on this call's argument.
    }
    setVisible(false)
    if (state === 'granted') {
      initMetaPixel()
      initGoogleTag()
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie choices"
      className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-w-3xl flex-col gap-3 rounded-t-2xl px-5 py-4 text-sm sm:flex-row sm:items-center"
      style={{ background: 'var(--surface2, #16130E)', color: 'var(--text, #F4F0E9)', border: '1px solid var(--hairline2, rgba(255,255,255,0.12))' }}
    >
      <p className="flex-1">
        We measure our ads on this website. Accept to let Meta and Google see that you
        arrived from one of them. The Argo app itself carries no ad trackers.{' '}
        <a href="/privacy" className="underline">Privacy</a>
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => decide('denied')} className="rounded-full px-4 py-2" style={{ border: '1px solid var(--hairline2, rgba(255,255,255,0.2))' }}>
          Decline
        </button>
        <button type="button" onClick={() => decide('granted')} className="rounded-full px-4 py-2 font-semibold" style={{ background: '#F2CB4C', color: '#171412' }}>
          Accept
        </button>
      </div>
    </div>
  )
}
