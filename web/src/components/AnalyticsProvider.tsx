'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { captureAttribution } from '@/lib/analytics/attribution'
import { readConsent } from '@/lib/analytics/consent'
import { initPostHog } from '@/lib/analytics/posthog'
import { initMetaPixel } from '@/lib/analytics/meta'
import { initGoogleTag } from '@/lib/analytics/google'
import { track } from '@/lib/analytics/track'
import { EVENTS } from '@/lib/analytics/events'
import ConsentBanner from '@/components/ConsentBanner'

/** Marks that this session already reported passing half the page. */
const SCROLL_MARK_KEY = 'argo-scroll-50'

/**
 * Mounts the whole web measurement stack. Renders nothing except the consent
 * banner.
 *
 * Note it reads `window.location.search` rather than `useSearchParams()`. That
 * is not an oversight: `useSearchParams` forces the nearest Suspense boundary to
 * bail out to client rendering for the entire subtree, which would opt the
 * marketing pages out of static rendering just to read a UTM parameter.
 */
export default function AnalyticsProvider() {
  const pathname = usePathname()

  useEffect(() => {
    // Capture FIRST, so the campaign is in storage before any event is built.
    captureAttribution(window.location.search, window.sessionStorage)
    initPostHog()
    try {
      if (readConsent(window.localStorage) === 'granted') {
        initMetaPixel()
        initGoogleTag()
      }
    } catch {
      // No storage means no recorded consent, which means no Meta and no Google.
    }
  }, [])

  useEffect(() => {
    // One page_view per route change. The App Router navigates client-side, so
    // without this only the first page a visitor lands on is ever counted.
    if (!pathname) return
    track(EVENTS.PAGE_VIEW, { path: pathname })
  }, [pathname])

  useEffect(() => {
    // Engagement proxy, once per session. Cheap, and it separates "the ad sent
    // someone who bounced" from "the ad sent someone the page lost halfway".
    let done = false
    try {
      done = window.sessionStorage.getItem(SCROLL_MARK_KEY) === '1'
    } catch {
      // Treat unreadable storage as not-yet-fired; worst case is a duplicate.
    }
    if (done) return

    function onScroll() {
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (max <= 0) return
      if (window.scrollY / max < 0.5) return
      window.removeEventListener('scroll', onScroll)
      try { window.sessionStorage.setItem(SCROLL_MARK_KEY, '1') } catch { /* best effort */ }
      track(EVENTS.LANDING_SCROLL_50)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return <ConsentBanner />
}
