import { vi, describe, it, expect, beforeEach } from 'vitest'

// `config` is parsed from process.env at import time, so the module is mocked
// rather than the env mutated. Same approach as middleware/requirePro.test.ts.
const { cfg, state } = vi.hoisted(() => ({
  cfg: {
    POSTHOG_API_HOST: 'https://ph.example.com',
    POSTHOG_PROJECT_API_KEY: 'phc_test',
  } as Record<string, string | undefined>,
  state: { enabled: true },
}))

vi.mock('../config', () => ({
  config: cfg,
  posthogEnabled: () => state.enabled,
}))

import { capturePostHog, SERVER_EVENTS } from './posthog'

function okFetch() {
  return vi.fn(async () => ({ ok: true, status: 200 }) as any)
}

describe('capturePostHog', () => {
  beforeEach(() => {
    state.enabled = true
    cfg.POSTHOG_API_HOST = 'https://ph.example.com'
    cfg.POSTHOG_PROJECT_API_KEY = 'phc_test'
  })

  it('no-ops without touching the network when PostHog is not configured', async () => {
    state.enabled = false
    const f = okFetch()
    expect(await capturePostHog(SERVER_EVENTS.SUBSCRIPTION_STARTED, 'uid1', {}, f)).toBe(false)
    expect(f).not.toHaveBeenCalled()
  })

  it('posts the project key, event name, and distinct id to the capture endpoint', async () => {
    const f = okFetch()
    expect(await capturePostHog(SERVER_EVENTS.SUBSCRIPTION_STARTED, 'uid1', { store: 'app_store' }, f)).toBe(true)
    const [url, init] = f.mock.calls[0]
    expect(url).toBe('https://ph.example.com/capture/')
    const body = JSON.parse((init as any).body)
    expect(body.api_key).toBe('phc_test')
    expect(body.event).toBe('subscription_started')
    expect(body.distinct_id).toBe('uid1')
    expect(body.properties.store).toBe('app_store')
  })

  it('disables geo lookup so the server never hands user locations to the vendor', async () => {
    const f = okFetch()
    await capturePostHog(SERVER_EVENTS.SUBSCRIPTION_RENEWED, 'uid1', {}, f)
    const body = JSON.parse((f.mock.calls[0][1] as any).body)
    expect(body.properties.$geoip_disable).toBe(true)
    expect(body.properties.$ip).toBeNull()
  })

  it('refuses to send an event with no distinct id', async () => {
    const f = okFetch()
    expect(await capturePostHog(SERVER_EVENTS.SUBSCRIPTION_STARTED, '', {}, f)).toBe(false)
    expect(f).not.toHaveBeenCalled()
  })

  it('returns false instead of throwing when the request fails', async () => {
    const f = vi.fn(async () => { throw new Error('network down') })
    await expect(
      capturePostHog(SERVER_EVENTS.SUBSCRIPTION_STARTED, 'uid1', {}, f as any),
    ).resolves.toBe(false)
  })

  it('returns false on a non-2xx response', async () => {
    const f = vi.fn(async () => ({ ok: false, status: 500 }) as any)
    expect(await capturePostHog(SERVER_EVENTS.SUBSCRIPTION_STARTED, 'uid1', {}, f)).toBe(false)
  })
})

describe('SERVER_EVENTS', () => {
  it('is the closed list of server-originated events', () => {
    expect(Object.values(SERVER_EVENTS).sort()).toEqual(
      [
        'subscription_cancelled',
        'subscription_expired',
        'subscription_renewed',
        'subscription_started',
        'trial_converted',
        'trial_started',
      ].sort(),
    )
  })
})
