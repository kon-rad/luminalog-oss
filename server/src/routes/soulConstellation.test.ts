import { describe, it, expect, beforeEach, vi } from 'vitest'

const store = vi.hoisted(() => ({ data: new Map<string, any>() }))
function deepMerge(a: any, b: any): any {
  const out = { ...a }
  for (const k of Object.keys(b)) {
    out[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])
      ? deepMerge(a?.[k] ?? {}, b[k]) : b[k]
  }
  return out
}
const db = vi.hoisted(() => ({
  collection: (_c: string) => ({
    doc: (id: string) => ({
      get: async () => ({ exists: store.data.has(id), data: () => store.data.get(id) }),
      set: async (d: any, opts?: any) => {
        store.data.set(id, opts?.merge ? deepMerge(store.data.get(id) ?? {}, d) : d)
      },
    }),
  }),
}))
vi.mock('../middleware/firebaseAuth', () => ({
  firebaseAuth: (req: any, _res: any, next: any) => { req.uid = 'u'; next() },
  db,
}))
vi.mock('../config', () => ({ config: { BASE_CHAIN: 'base-sepolia' }, aiModel1Enabled: () => false }))
const refreshSoulImage = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('../services/chain/soulService', () => ({ refreshSoulImage }))

import { putConstellationHandler } from './soul'

function mockRes() {
  const res: any = { statusCode: 200, body: undefined }
  res.status = (c: number) => { res.statusCode = c; return res }
  res.json = (b: any) => { res.body = b; return res }
  return res
}
const pt = (o: Partial<any> = {}) => ({ dayIndex: 20000, date: '2024-10-04', x: 0.1, y: -0.2, z: 0.3, wordCount: 800, streakAtEarn: 1, ...o })

describe('putConstellationHandler', () => {
  beforeEach(() => { store.data.clear(); refreshSoulImage.mockClear() })

  it('stores points, bumps version, fires image refresh', async () => {
    store.data.set('u', { constellation: { version: 4, points: [] } })
    const req: any = { uid: 'u', body: { points: [pt(), pt({ dayIndex: 20001, date: '2024-10-05' })] } }
    const res = mockRes()
    await putConstellationHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ version: 5, count: 2 })
    expect(store.data.get('u').constellation.points).toHaveLength(2)
    expect(refreshSoulImage).toHaveBeenCalledWith('u')
  })

  it('rejects a non-array points body', async () => {
    const req: any = { uid: 'u', body: { points: 'nope' } }
    const res = mockRes()
    await putConstellationHandler(req, res)
    expect(res.statusCode).toBe(400)
    expect(refreshSoulImage).not.toHaveBeenCalled()
  })

  it('rejects out-of-range / non-finite coordinates', async () => {
    for (const bad of [pt({ x: 1.5 }), pt({ y: Number.NaN }), pt({ z: Infinity })]) {
      const res = mockRes()
      await putConstellationHandler({ uid: 'u', body: { points: [bad] } } as any, res)
      expect(res.statusCode).toBe(400)
    }
  })

  it('rejects malformed point fields', async () => {
    for (const bad of [pt({ dayIndex: 1.5 }), pt({ wordCount: -1 }), pt({ date: '' })]) {
      const res = mockRes()
      await putConstellationHandler({ uid: 'u', body: { points: [bad] } } as any, res)
      expect(res.statusCode).toBe(400)
    }
  })
})
