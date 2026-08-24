import posthog from 'posthog-js'

/**
 * PostHog runs WITHOUT consent, which is only defensible because of how it is
 * configured here: cookieless (`persistence: 'memory'`), autocapture off, and
 * session recording off. Autocapture and recording would sweep up whatever is
 * on screen, and on the web app's journal routes that is the user's journal.
 * Those two flags are load-bearing privacy controls, not performance tuning.
 */
let started = false

export function initPostHog(): void {
  if (started) return
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  if (!key || !host) return

  posthog.init(key, {
    api_host: host,
    persistence: 'memory',
    autocapture: false,
    disable_session_recording: true,
    capture_pageview: false,
    capture_pageleave: false,
  })
  started = true
}

export function posthogCapture(
  name: string,
  props: Record<string, unknown>,
  beacon: boolean,
): void {
  if (!started) return
  try {
    posthog.capture(name, props, beacon ? { transport: 'sendBeacon' } : undefined)
  } catch {
    // Analytics never throws into a user flow.
  }
}

export function identifyUser(uid: string): void {
  if (!started || !uid) return
  try {
    posthog.identify(uid)
  } catch {
    // Best effort.
  }
}
