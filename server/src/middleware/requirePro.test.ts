import { vi, describe, it, expect, beforeEach } from 'vitest'

// Shared in-memory `users` store + a mutable enforcement flag, mirroring the
// harness in routes/consent.test.ts (same deepMerge/serverTimestamp handling)
// so the guard is exercised against a Firestore-shaped double rather than mocks
// that only satisfy the exact calls it happens to make today.
const { store, db, state } = vi.hoisted(() => {
  const store = new Map<string, Record<string, any>>()
  const state = { enforce: true }

  function isPlainObject(x: any): x is Record<string, any> {
    return x !== null && typeof x === 'object' && !Array.isArray(x) && !x.__serverTimestamp
  }
  function deepMerge(t: Record<string, any>, p: Record<string, any>): Record<string, any> {
    const out = { ...t }
    for (const [k, v] of Object.entries(p)) {
      if (isPlainObject(v) && isPlainObject(out[k])) out[k] = deepMerge(out[k], v)
      else out[k] = v
    }
    return out
  }
  const db = {
    collection: (_n: string) => ({
      doc: (id: string) => ({
        id,
        async set(data: Record<string, any>, opts?: { merge?: boolean }) {
          const existing = opts?.merge ? store.get(id) ?? {} : {}
          store.set(id, deepMerge(existing, data))
        },
        async get() {
          const d = store.get(id)
          return { exists: !!d, id, data: () => d, get: (f: string) => d?.[f] }
        },
      }),
    }),
  }
  return { store, db, state }
})

vi.mock('./firebaseAuth', () => ({
  firebaseAuth: (req: any, _res: any, next: any) => { req.uid = 'u'; next() },
  db,
}))
vi.mock('../config', () => ({
  config: {},
  enforceProEnabled: () => state.enforce,
  enforceAiConsentEnabled: () => false,
}))
vi.mock('firebase-admin', () => ({
  default: {
    firestore: { FieldValue: { serverTimestamp: () => ({ __serverTimestamp: true }) } },
  },
}))

import { requirePro } from './requirePro'

const NOW = Date.now()
const FUTURE = NOW + 30 * 24 * 60 * 60 * 1000
const PAST = NOW - 30 * 24 * 60 * 60 * 1000

function mockRes() {
  const res: any = { statusCode: 200 }
  res.status = (c: number) => { res.statusCode = c; return res }
  res.json = (b: any) => { res.body = b; return res }
  return res
}

/** A lookup double standing in for the RevenueCat REST call. */
function lookupReturning(value: { proExpiresAtMs: number; source: string } | null) {
  return vi.fn(async () => value)
}

beforeEach(() => { store.clear(); state.enforce = true })

describe('requirePro', () => {
  it('is a pure no-op when ENFORCE_PRO is off', async () => {
    state.enforce = false
    const next = vi.fn()
    const res = mockRes()
    const lookup = lookupReturning(null)
    // No uid and no user doc: still passes, because the flag short-circuits
    // before anything is read. This is what makes the dark deploy safe.
    await requirePro({} as any, res, next, db as any, lookup)
    expect(next).toHaveBeenCalledOnce()
    expect(res.body).toBeUndefined()
    expect(lookup).not.toHaveBeenCalled()
  })

  it('401s when no upstream auth middleware set req.uid', async () => {
    const next = vi.fn()
    const res = mockRes()
    await requirePro({} as any, res, next, db as any, lookupReturning(null))
    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(401)
  })

  it('passes a user whose stored entitlement is still active', async () => {
    store.set('u', { entitlement: { proExpiresAtMs: FUTURE, source: 'app_store' } })
    const next = vi.fn()
    const res = mockRes()
    const lookup = lookupReturning(null)
    await requirePro({ uid: 'u' } as any, res, next, db as any, lookup)
    expect(next).toHaveBeenCalledOnce()
    // Fast path: an active local entitlement must not spend a RevenueCat call.
    expect(lookup).not.toHaveBeenCalled()
  })

  it('402s a user whose stored entitlement has expired and whom RevenueCat does not know', async () => {
    store.set('u', { entitlement: { proExpiresAtMs: PAST, source: 'app_store' } })
    const next = vi.fn()
    const res = mockRes()
    await requirePro({ uid: 'u' } as any, res, next, db as any, lookupReturning(null))
    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(402)
    expect(res.body).toMatchObject({ error: 'pro_required' })
  })

  it('402s a user with no entitlement field at all', async () => {
    store.set('u', { displayName: 'free user' })
    const next = vi.fn()
    const res = mockRes()
    await requirePro({ uid: 'u' } as any, res, next, db as any, lookupReturning(null))
    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(402)
  })

  it('self-heals a missed webhook: RevenueCat says active, so it writes through and passes', async () => {
    // Firestore has nothing (the webhook never landed), but the user really did pay.
    const lookup = lookupReturning({ proExpiresAtMs: FUTURE, source: 'rc_billing' })
    const next = vi.fn()
    const res = mockRes()
    await requirePro({ uid: 'u' } as any, res, next, db as any, lookup)
    expect(lookup).toHaveBeenCalledWith('u')
    expect(next).toHaveBeenCalledOnce()
    // Written back, so the next request takes the fast path.
    expect(store.get('u')?.entitlement).toMatchObject({
      proExpiresAtMs: FUTURE,
      source: 'rc_billing',
    })
  })

  it('does not self-heal into an active state when RevenueCat also reports expired', async () => {
    const lookup = lookupReturning({ proExpiresAtMs: PAST, source: 'app_store' })
    const next = vi.fn()
    const res = mockRes()
    await requirePro({ uid: 'u' } as any, res, next, db as any, lookup)
    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(402)
  })

  it('degrades to Firestore-only when the RevenueCat lookup throws', async () => {
    // No REST key configured, or RevenueCat is down. Must not 500 the AI route.
    const lookup = vi.fn(async () => { throw new Error('rc unreachable') })
    const next = vi.fn()
    const res = mockRes()
    await requirePro({ uid: 'u' } as any, res, next, db as any, lookup)
    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(402)
  })

  it('keeps entitlements per-user: A paying does not unlock B', async () => {
    store.set('a', { entitlement: { proExpiresAtMs: FUTURE, source: 'app_store' } })
    const next = vi.fn()
    const res = mockRes()
    await requirePro({ uid: 'b' } as any, res, next, db as any, lookupReturning(null))
    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(402)
  })
})
