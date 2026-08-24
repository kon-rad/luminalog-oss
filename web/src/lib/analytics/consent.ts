/**
 * Consent gate for the advertising layer only.
 *
 * The stack is split across this boundary on purpose:
 *   - PostHog runs WITHOUT consent. It is first-party, proxied, cookieless, and
 *     stores nothing on the device.
 *   - Meta Pixel, Meta CAPI, and GA4 load ONLY after `granted`.
 *
 * The consequence is that the number that matters most at low ad spend, landing
 * visit to App Store tap by campaign, survives a decline. A decline degrades
 * Meta's and Google's optimization signal, not the ability to judge a creative.
 */
export type ConsentState = 'unknown' | 'granted' | 'denied'

export const CONSENT_STORAGE_KEY = 'argo_ad_consent'

export function readConsent(storage: Storage): ConsentState {
  try {
    const raw = storage.getItem(CONSENT_STORAGE_KEY)
    return raw === 'granted' || raw === 'denied' ? raw : 'unknown'
  } catch {
    return 'unknown'
  }
}

export function writeConsent(storage: Storage, state: 'granted' | 'denied'): void {
  try {
    storage.setItem(CONSENT_STORAGE_KEY, state)
  } catch {
    // Private-mode browsers can throw on write. Treated as a session-only choice.
  }
}
