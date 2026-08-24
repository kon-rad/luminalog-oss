'use client'

import { useEffect, useState } from 'react'
import { APP_STORE_URL, appStoreUrlFor } from '@/lib/appStore'
import { readAttribution } from '@/lib/analytics/attribution'
import { track } from '@/lib/analytics/track'
import { EVENTS } from '@/lib/analytics/events'

/**
 * Fire the primary conversion of the entire funnel.
 *
 * THE BEACON HAZARD, and the most likely bug in this build. Firing an analytics
 * event and immediately navigating to Apple drops the request in most browsers.
 * `beacon: true` routes PostHog and the Pixel through `sendBeacon` and the CAPI
 * call through `fetch(..., { keepalive: true })`, the only transports a browser
 * is obliged to finish after the page goes away. Get this wrong and
 * `app_store_click` undercounts badly and inconsistently across browsers, which
 * is worse than not measuring it, because the numbers still look plausible.
 *
 * Extracted from the component so the beacon flag is directly testable.
 */
export function fireAppStoreClick(trackFn: typeof track = track): void {
  try {
    trackFn(EVENTS.APP_STORE_CLICK, {}, { beacon: true })
  } catch {
    // Analytics never blocks a user flow. The navigation matters, the event does not.
  }
}

/**
 * The tokenized App Store URL for this session's campaign, which is what lets
 * App Store Connect report downloads and subscriptions per campaign. Untagged
 * traffic gets the plain listing rather than an empty `ct=`.
 */
export function appStoreHrefForSession(storage: Storage): string {
  try {
    return appStoreUrlFor(readAttribution(storage).campaign)
  } catch {
    return APP_STORE_URL
  }
}

/**
 * Single download CTA used everywhere the pre-launch waitlist CTA used to sit.
 *
 * Variants map onto the button classes already in `globals.css` so the button
 * inherits the surface it lands on:
 *   store  dark Apple-style pill, for light page backgrounds
 *   white  white pill, for the accent-gradient CTA panels
 *   full   full-width amber, for the pricing cards
 *   nav    compact, for the navbar
 */
type Variant = 'store' | 'white' | 'full' | 'nav'

const CLASS: Record<Variant, string> = {
  store: 'btn-store',
  white: 'btn-white',
  full: 'btn-amber-full',
  nav: 'nav-cta',
}

const GLYPH_SIZE: Record<Variant, number> = { store: 19, white: 20, full: 18, nav: 15 }

function AppleGlyph({ size }: { size: number }) {
  return (
    <svg
      width={size * (20 / 24)}
      height={size}
      viewBox="0 0 20 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M16.4 12.7c0-2.6 2.1-3.9 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.1 2.5-1.8 3-.5 7.5 1.2 9.9.8 1.2 1.8 2.5 3.1 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.5-1-2.5-3.7zM13.9 3.5c.7-.8 1.1-2 1-3.2-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.3z" />
    </svg>
  )
}

export default function AppStoreButton({
  variant = 'store',
  label = 'Download on the App Store',
  className = '',
  style,
}: {
  variant?: Variant
  label?: string
  className?: string
  style?: React.CSSProperties
}) {
  // Server-render the plain listing so the button works before hydration and
  // with JS disabled, then swap in the tokenized URL. The campaign lives in
  // sessionStorage, so it is unreadable during SSR by definition; computing it
  // in an effect is what keeps this free of a hydration mismatch.
  const [href, setHref] = useState(APP_STORE_URL)
  useEffect(() => { setHref(appStoreHrefForSession(window.sessionStorage)) }, [])

  return (
    <a
      href={href}
      onClick={() => fireAppStoreClick()}
      target="_blank"
      rel="noopener"
      className={`${CLASS[variant]} ${className}`.trim()}
      style={style}
      aria-label="Download Argo Private AI Journal on the App Store"
    >
      <AppleGlyph size={GLYPH_SIZE[variant]} />
      {label}
    </a>
  )
}
