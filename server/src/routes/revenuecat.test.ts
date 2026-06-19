import { vi, describe, it, expect } from 'vitest'

vi.mock('../config', () => ({
  config: { NODE_ENV: 'test', REVENUECAT_WEBHOOK_SECRET: 'rc_secret_test' },
}))
vi.mock('../middleware/firebaseAuth', () => ({ db: {} }))

import { creditsForProduct, revenueCatWebhookHandler } from './revenuecat'

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
