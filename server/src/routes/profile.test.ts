import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('../middleware/firebaseAuth', () => ({ db: {}, firebaseAuth: vi.fn() }))
import { createProfileHandlers } from './profile'
import { MemoryUsernameStore } from '../test/memoryStores'

function mockRes() {
  const res: any = { statusCode: 200 }
  res.status = vi.fn((c: number) => { res.statusCode = c; return res })
  res.json = vi.fn((b: any) => { res.body = b; return res })
  return res
}

const now = new Date('2026-09-27T00:00:00.500Z')
let store: MemoryUsernameStore
let h: ReturnType<typeof createProfileHandlers>
beforeEach(() => {
  store = new MemoryUsernameStore()
  store.users.set('u1', { username: null, changedAt: null })
  store.users.set('u2', { username: null, changedAt: null })
  h = createProfileHandlers({ usernames: store, now: () => now })
})

describe('check', () => {
  it('reports available, taken, reserved, invalid; own name is available', async () => {
    store.claims.set('taken_one', 'u2')
    store.claims.set('mine', 'u1')
    const cases: Array<[string, any]> = [
      ['@Fresh_Name', { username: 'fresh_name', available: true }],
      ['taken_one', { username: 'taken_one', available: false, reason: 'taken' }],
      ['admin', { username: 'admin', available: false, reason: 'reserved' }],
      ['ab', { username: 'ab', available: false, reason: 'invalid' }],
      ['mine', { username: 'mine', available: true }],
    ]
    for (const [u, expected] of cases) {
      const res = mockRes()
      await h.check({ uid: 'u1', query: { u } } as any, res)
      expect(res.body).toMatchObject(expected)
    }
  })

  it('treats a claim held by a deleted account as available', async () => {
    store.claims.set('ghost', 'deleted-uid')
    const res = mockRes()
    await h.check({ uid: 'u1', query: { u: 'ghost' } } as any, res)
    expect(res.body).toMatchObject({ available: true })
  })
})

describe('set', () => {
  it('claims, returns second-precision dates, and blocks a change within 30 days', async () => {
    const res = mockRes()
    await h.set({ uid: 'u1', body: { username: 'Konrad' } } as any, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ username: 'konrad', usernameChangedAt: '2026-09-27T00:00:00Z', nextChangeAt: '2026-10-27T00:00:00Z' })

    const again = mockRes()
    await h.set({ uid: 'u1', body: { username: 'other' } } as any, again)
    expect(again.statusCode).toBe(429)
    expect(again.body).toEqual({ error: 'too_soon', nextChangeAt: '2026-10-27T00:00:00Z' })
  })

  it('409 when taken, 400 when invalid or missing', async () => {
    store.claims.set('konrad', 'u2')
    const taken = mockRes()
    await h.set({ uid: 'u1', body: { username: 'konrad' } } as any, taken)
    expect(taken.statusCode).toBe(409)
    const bad = mockRes()
    await h.set({ uid: 'u1', body: {} } as any, bad)
    expect(bad.statusCode).toBe(400)
  })
})