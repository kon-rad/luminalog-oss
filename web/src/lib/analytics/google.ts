import { EVENTS, type EventName, type EventProps } from './events'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

let started = false

/** Loads gtag.js for GA4 and Google Ads. Called ONLY after consent is granted. */
export function initGoogleTag(): void {
  if (started || typeof window === 'undefined') return
  const ga4 = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID
  const ads = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
  if (!ga4 && !ads) return

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    // gtag relies on `arguments`, so this cannot be a rest-parameter arrow.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments)
  }
  window.gtag('js', new Date())
  if (ga4) window.gtag('config', ga4)
  if (ads) window.gtag('config', ads)

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${ga4 || ads}`
  document.head.appendChild(script)
  started = true
}

export function googleCapture(name: EventName, props: EventProps): void {
  if (!started) return
  try {
    window.gtag?.('event', name, props)

    // The App Store tap is the conversion Google Ads optimizes against, so it
    // is also sent as a conversion action with its own label.
    const label = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL
    const ads = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
    if (name === EVENTS.APP_STORE_CLICK && label && ads) {
      window.gtag?.('event', 'conversion', { send_to: `${ads}/${label}` })
    }
  } catch {
    // Never throw into a user flow.
  }
}
