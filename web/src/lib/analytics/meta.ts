import type { Attribution } from './attribution'
import { META_EVENT_MAP, type EventName, type EventProps } from './events'

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean }
    _fbq?: unknown
  }
}

let started = false

/** Loads the Pixel. Called ONLY after consent is granted. */
export function initMetaPixel(): void {
  if (started || typeof window === 'undefined') return
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID
  if (!pixelId) return

  /* eslint-disable */
  ;(function (f: any, b: any, e: string, v: string) {
    if (f.fbq) return
    const n: any = (f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments)
    })
    if (!f._fbq) f._fbq = n
    n.push = n
    n.loaded = true
    n.version = '2.0'
    n.queue = []
    const t = b.createElement(e) as HTMLScriptElement
    t.async = true
    t.src = v
    const s = b.getElementsByTagName(e)[0]
    s.parentNode.insertBefore(t, s)
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
  /* eslint-enable */

  window.fbq?.('init', pixelId)
  started = true
}

function uuid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/**
 * Fires the browser Pixel and the server relay with a SHARED event id, which is
 * what makes Meta treat them as one event instead of two.
 */
export function metaCapture(
  name: EventName,
  props: EventProps,
  attribution: Attribution,
  beacon: boolean,
): void {
  const standard = META_EVENT_MAP[name]
  if (!standard) return

  const eventId = uuid()

  try {
    window.fbq?.('track', standard, props, { eventID: eventId })
  } catch {
    // Never throw into a user flow.
  }

  const body = JSON.stringify({
    eventId,
    eventName: standard,
    eventSourceUrl: window.location.href,
    fbc: attribution.fbclid ? `fb.1.${Date.now()}.${attribution.fbclid}` : null,
  })

  try {
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon('/api/meta/capi', new Blob([body], { type: 'application/json' }))
    } else {
      void fetch('/api/meta/capi', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
      })
    }
  } catch {
    // Best effort.
  }
}
