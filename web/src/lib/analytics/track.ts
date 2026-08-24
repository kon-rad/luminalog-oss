import type { Attribution } from './attribution'
import { readAttribution } from './attribution'
import { readConsent } from './consent'
import type { EventName, EventProps } from './events'
import { posthogCapture } from './posthog'
import { metaCapture } from './meta'
import { googleCapture } from './google'

/**
 * Single payload shape for every destination, so the campaign slug is stamped
 * on every event exactly once and cannot be forgotten at a call site.
 *
 * Click ids (fbclid, gclid) are deliberately NOT included: they belong in the
 * Meta CAPI request, where they identify the ad click, and nowhere else.
 */
export function buildEventPayload(
  _name: EventName,
  props: EventProps,
  attribution: Attribution,
): EventProps {
  return {
    ...props,
    campaign: attribution.campaign,
    source: attribution.source,
    medium: attribution.medium,
  }
}

/**
 * Fans one event out to PostHog always, and to Meta and Google only when the
 * visitor has granted consent.
 *
 * `beacon` must be true for any event fired immediately before navigating away
 * (see the App Store button). Without it the request is cancelled by the
 * navigation and the conversion silently undercounts.
 */
export function track(
  name: EventName,
  props: EventProps = {},
  opts: { beacon?: boolean } = {},
): void {
  if (typeof window === 'undefined') return

  const attribution = readAttribution(window.sessionStorage)
  const payload = buildEventPayload(name, props, attribution)
  const beacon = opts.beacon === true

  posthogCapture(name, payload, beacon)

  if (readConsent(window.localStorage) !== 'granted') return
  metaCapture(name, payload, attribution, beacon)
  googleCapture(name, payload)
}
