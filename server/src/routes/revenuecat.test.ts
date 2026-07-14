import { vi, describe, it, expect } from 'vitest'

vi.mock('../config', () => ({
  config: { NODE_ENV: 'test', REVENUECAT_WEBHOOK_SECRET: 'rc_secret_test' },
}))
vi.mock('../middleware/firebaseAuth', () => ({ db: {} }))

import { creditsForProduct, proExpiryFromEvent, revenueCatWebhookHandler } from './revenuecat'

describe('creditsForProduct', () => {
  it('maps every known consumable product id to its credit count', () => {
    expect(creditsForProduct('com.luminalog.credits.5')).toBe(5)
    expect(creditsForProduct('com.luminalog.credits.10')).toBe(10)
    expect(creditsForProduct('com.luminalog.credits.20')).toBe(20)
    expect(creditsForProduct('com.luminalog.credits.50')).toBe(50)
  })

  it('returns null for unknown products (subscriptions, junk)', () => {
    expect(creditsForProduct('com.luminalog.pro.monthly')).toBeNull()
    expect(creditsForProduct('nonsense')).toBeNull()
    expect(creditsForProduct(undefined)).toBeNull()
  })
})

function mockRes() {
  const res: any = { statusCode: 200 }
  res.status = vi.fn((c: number) => { res.statusCode = c; return res })
  res.json = vi.fn((b: any) => { res.body = b; return res })
  return res
}

// Minimal Firestore double: a transaction whose get() reports whether the event
// was already processed, and records set()/update() calls.
function mockDb(alreadyProcessed = false) {
  const writes: any[] = []
  const tx = {
    get: vi.fn().mockResolvedValue({ exists: alreadyProcessed }),
    set: vi.fn((ref: any, data: any, opts: any) => writes.push({ op: 'set', ref, data, opts })),
    update: vi.fn((ref: any, data: any) => writes.push({ op: 'update', ref, data })),
  }
  const db: any = {
    collection: (name: string) => ({ doc: (id: string) => ({ path: `${name}/${id}` }) }),
    runTransaction: vi.fn(async (fn: any) => fn(tx)),
  }
  return { db, writes, tx }
}

function purchaseEvent(overrides: Record<string, unknown> = {}) {
  return {
    event: {
      type: 'NON_RENEWING_PURCHASE',
      id: 'evt_1',
      app_user_id: 'user-123',
      product_id: 'com.luminalog.credits.10',
      ...overrides,
    },
  }
}

describe('revenueCatWebhookHandler', () => {
  it('rejects a bad secret with 401', async () => {
    const { db } = mockDb()
    const req: any = { headers: { authorization: 'wrong' }, body: purchaseEvent() }
    const res = mockRes()
    await revenueCatWebhookHandler(req, res, db)
    expect(res.statusCode).toBe(401)
  })

  it('accepts the secret from the ?secret= URL query param', async () => {
    const { db, writes } = mockDb(false)
    const req: any = { query: { secret: 'rc_secret_test' }, headers: {}, body: purchaseEvent() }
    const res = mockRes()
    await revenueCatWebhookHandler(req, res, db)
    expect(res.statusCode).toBe(200)
    expect(writes.find(w => w.ref.path === 'users/user-123')).toBeTruthy()
  })

  it('rejects a bad ?secret= query param with 401', async () => {
    const { db } = mockDb()
    const req: any = { query: { secret: 'wrong' }, headers: {}, body: purchaseEvent() }
    const res = mockRes()
    await revenueCatWebhookHandler(req, res, db)
    expect(res.statusCode).toBe(401)
  })

  it('credits the user once for a NON_RENEWING_PURCHASE', async () => {
    const { db, writes } = mockDb(false)
    const req: any = { headers: { authorization: 'rc_secret_test' }, body: purchaseEvent() }
    const res = mockRes()
    await revenueCatWebhookHandler(req, res, db)
    expect(res.statusCode).toBe(200)
    const credited = writes.find(w => w.ref.path === 'users/user-123')
    expect(credited).toBeTruthy()
  })

  it('is idempotent: a re-delivered event credits nothing', async () => {
    const { db, writes } = mockDb(true) // event already recorded
    const req: any = { headers: { authorization: 'rc_secret_test' }, body: purchaseEvent() }
    const res = mockRes()
    await revenueCatWebhookHandler(req, res, db)
    expect(res.statusCode).toBe(200)
    expect(writes.find(w => w.ref.path === 'users/user-123')).toBeUndefined()
  })

  it('ignores non-purchase event types with 200', async () => {
    const { db, writes } = mockDb()
    const req: any = {
      headers: { authorization: 'rc_secret_test' },
      body: purchaseEvent({ type: 'RENEWAL' }),
    }
    const res = mockRes()
    await revenueCatWebhookHandler(req, res, db)
    expect(res.statusCode).toBe(200)
    expect(writes.length).toBe(0)
  })

  it('ignores unknown products with 200 and no write', async () => {
    const { db, writes } = mockDb()
    const req: any = {
      headers: { authorization: 'rc_secret_test' },
      body: purchaseEvent({ product_id: 'com.luminalog.pro.monthly' }),
    }
    const res = mockRes()
    await revenueCatWebhookHandler(req, res, db)
    expect(res.statusCode).toBe(200)
    expect(writes.length).toBe(0)
  })
})

describe('proExpiryFromEvent', () => {
  const base = {
    type: 'INITIAL_PURCHASE',
    entitlement_ids: ['pro'],
    expiration_at_ms: 2_000_000_000_000,
    store: 'RC_BILLING',
  }

  it('returns expiry + source for a pro subscription lifecycle event', () => {
    expect(proExpiryFromEvent(base)).toEqual({ proExpiresAtMs: 2_000_000_000_000, source: 'rc_billing' })
  })

  it('handles RENEWAL, PRODUCT_CHANGE, UNCANCELLATION, EXPIRATION (past expiry) the same way', () => {
    for (const type of ['RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'CANCELLATION']) {
      expect(proExpiryFromEvent({ ...base, type })).toEqual({ proExpiresAtMs: 2_000_000_000_000, source: 'rc_billing' })
    }
    // EXPIRATION carries a past expiry; still surfaced (read-time compares to now)
    expect(proExpiryFromEvent({ ...base, type: 'EXPIRATION', expiration_at_ms: 100 }))
      .toEqual({ proExpiresAtMs: 100, source: 'rc_billing' })
  })

  it('maps App Store store to source app_store', () => {
    expect(proExpiryFromEvent({ ...base, store: 'APP_STORE' })?.source).toBe('app_store')
  })

  it('returns null when the pro entitlement is not involved, or no expiry, or a non-subscription type', () => {
    expect(proExpiryFromEvent({ ...base, entitlement_ids: ['other'] })).toBeNull()
    expect(proExpiryFromEvent({ ...base, expiration_at_ms: undefined })).toBeNull()
    expect(proExpiryFromEvent({ ...base, type: 'NON_RENEWING_PURCHASE' })).toBeNull()
    expect(proExpiryFromEvent({ type: 'TEST' })).toBeNull()
  })
})

describe('revenueCatWebhookHandler — subscription entitlement', () => {
  const secret = 'rc_secret_test'
  function subReq() {
    return {
      query: { secret },
      headers: {},
      body: { event: {
        id: 'evt_sub_1', type: 'INITIAL_PURCHASE', app_user_id: 'uid_1',
        entitlement_ids: ['pro'], expiration_at_ms: 2_000_000_000_000, store: 'RC_BILLING',
      } },
    } as any
  }

  it('writes users/{uid}.entitlement for a pro subscription event, once', async () => {
    const { db, writes } = mockDb(false)
    const res = mockRes()
    await revenueCatWebhookHandler(subReq(), res, db)
    expect(res.body).toEqual({ ok: true })
    const entWrite = writes.find((w: any) => w.data?.entitlement)
    expect(entWrite.data.entitlement.proExpiresAtMs).toBe(2_000_000_000_000)
    expect(entWrite.data.entitlement.source).toBe('rc_billing')
  })

  it('is idempotent — a re-delivered event writes nothing', async () => {
    const { db, writes } = mockDb(true) // event already processed
    const res = mockRes()
    await revenueCatWebhookHandler(subReq(), res, db)
    expect(res.body).toEqual({ ok: true })
    expect(writes.find((w: any) => w.data?.entitlement)).toBeUndefined()
  })

  it('ignores non-pro / non-subscription events (still 200)', async () => {
    const { db, writes } = mockDb(false)
    const res = mockRes()
    const req = subReq(); req.body.event.entitlement_ids = ['other']
    await revenueCatWebhookHandler(req, res, db)
    expect(res.body).toEqual({ ok: true })
    expect(writes.find((w: any) => w.data?.entitlement)).toBeUndefined()
  })
})
