import { vi, describe, it, expect, beforeEach } from 'vitest'

// Shared in-memory `users` store + a mutable enforcement flag.
const { store, db, state } = vi.hoisted(() => {
  const store = new Map<string, Record<string, any>>()
  const state = { enforce: false }

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
  function resolve(data: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = { ...data }
    for (const [k, v] of Object.entries(out)) {
      if (v && (v as any).__serverTimestamp) out[k] = { toDate: () => new Date('2026-07-09T00:00:00.000Z') }
      else if (isPlainObject(v)) out[k] = resolve(v)
    }
    return out
  }
  const db = {
    collection: (_n: string) => ({
      doc: (id: string) => ({
        id,
        async set(data: Record<string, any>, opts?: { merge?: boolean }) {
          const existing = opts?.merge ? store.get(id) ?? {} : {}
          store.set(id, resolve(deepMerge(existing, data)))
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

vi.mock('../middleware/firebaseAuth', () => ({
  firebaseAuth: (req: any, _res: any, next: any) => { req.uid = 'u'; next() },
  db,
}))
vi.mock('../config', () => ({
  config: {},
  enforceAiConsentEnabled: () => state.enforce,
}))
vi.mock('firebase-admin', () => ({
  default: {
    firestore: { FieldValue: { serverTimestamp: () => ({ __serverTimestamp: true }) } },
  },
}))

import { putConsentHandler, getConsentHandler } from './consent'
import { requireAiConsent } from '../middleware/requireAiConsent'

function mockRes() {
  const res: any = { statusCode: 200 }
  res.status = (c: number) => { res.statusCode = c; return res }
  res.json = (b: any) => { res.body = b; return res }
  return res
}

beforeEach(() => { store.clear(); state.enforce = false })

describe('consent PUT then GET round-trip (userId-scoped)', () => {
  it('records and reads back consent', async () => {
    const putRes = mockRes()
    await putConsentHandler({ uid: 'u', body: { aiDataSharing: true, version: '2026-07-09' } } as any, putRes)
    expect(putRes.body).toEqual({ ok: true, aiDataSharing: true, version: '2026-07-09' })

    const getRes = mockRes()
    await getConsentHandler({ uid: 'u' } as any, getRes)
    expect(getRes.body.consent).toMatchObject({ aiDataSharing: true, version: '2026-07-09' })
    expect(getRes.body.consent.acceptedAt).toBe('2026-07-09T00:00:00.000Z')
  })

  it('GET with no record → null', async () => {
    const getRes = mockRes()
    await getConsentHandler({ uid: 'nobody' } as any, getRes)
    expect(getRes.body).toEqual({ consent: null })
  })

  it('cross-tenant: A never sees B consent', async () => {
    await putConsentHandler({ uid: 'a', body: { aiDataSharing: true, version: 'vA' } } as any, mockRes())
    const bRes = mockRes()
    await getConsentHandler({ uid: 'b' } as any, bRes)
    expect(bRes.body.consent).toBeNull()
  })

  it('400 on missing/invalid fields', async () => {
    const r1 = mockRes()
    await putConsentHandler({ uid: 'u', body: { version: 'v' } } as any, r1)
    expect(r1.statusCode).toBe(400)
    const r2 = mockRes()
    await putConsentHandler({ uid: 'u', body: { aiDataSharing: true } } as any, r2)
    expect(r2.statusCode).toBe(400)
  })
})

describe('requireAiConsent guard gated by ENFORCE_AI_CONSENT (default OFF)', () => {
  it('flag OFF → passes through even with NO consent (existing users unaffected)', async () => {
    state.enforce = false
    let called = false
    const res = mockRes()
    await requireAiConsent({ uid: 'u' } as any, res, () => { called = true })
    expect(called).toBe(true)
    expect(res.body).toBeUndefined()
  })

  it('flag ON + no consent → 403', async () => {
    state.enforce = true
    let called = false
    const res = mockRes()
    await requireAiConsent({ uid: 'u' } as any, res, () => { called = true })
    expect(called).toBe(false)
    expect(res.statusCode).toBe(403)
  })

  it('flag ON + consent aiDataSharing:true → passes', async () => {
    state.enforce = true
    await putConsentHandler({ uid: 'u', body: { aiDataSharing: true, version: 'v' } } as any, mockRes())
    let called = false
    const res = mockRes()
    await requireAiConsent({ uid: 'u' } as any, res, () => { called = true })
    expect(called).toBe(true)
  })

  it('flag ON + consent aiDataSharing:false → 403', async () => {
    state.enforce = true
    await putConsentHandler({ uid: 'u', body: { aiDataSharing: false, version: 'v' } } as any, mockRes())
    let called = false
    const res = mockRes()
    await requireAiConsent({ uid: 'u' } as any, res, () => { called = true })
    expect(called).toBe(false)
    expect(res.statusCode).toBe(403)
  })
})
