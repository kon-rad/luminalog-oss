import { describe, it, expect, vi, beforeEach } from 'vitest'

const store: Record<string, any> = {}
const centroidDocs: Record<string, any> = {}

const userDoc = (uid: string) => ({
  async get() { return { data: () => store[uid] } },
  async set(data: any, opts: any) { store[uid] = opts?.merge ? { ...store[uid], ...data } : data },
  collection() {
    return {
      doc(dayIndex: string) {
        return {
          async set(data: any, opts: any) {
            const k = `${uid}:${dayIndex}`
            centroidDocs[k] = opts?.merge ? { ...centroidDocs[k], ...data } : data
          },
          async delete() {
            delete centroidDocs[`${uid}:${dayIndex}`]
          },
        }
      },
      orderBy() {
        return {
          async get() {
            const rows = Object.entries(centroidDocs)
              .filter(([k]) => k.startsWith(`${uid}:`))
              .map(([, v]) => v)
              .sort((a, b) => a.dayIndex - b.dayIndex)
            return { docs: rows.map(d => ({ data: () => d })) }
          },
        }
      },
    }
  },
})

// Transaction handle delegates to the same async get/set/delete on the doc/query
// objects, mirroring Firestore's runTransaction semantics for the in-memory double.
const tx = {
  get: (ref: any) => ref.get(),
  set: (ref: any, data: any, opts: any) => ref.set(data, opts),
  delete: (ref: any) => ref.delete(),
}

vi.mock('../../middleware/firebaseAuth', () => ({
  db: {
    collection: () => ({ doc: (uid: string) => userDoc(uid) }),
    runTransaction: (fn: any) => fn(tx),
  },
}))
const computeDayCentroid = vi.fn()
vi.mock('./dayCentroid', () => ({ computeDayCentroid: (...a: any[]) => computeDayCentroid(...a) }))

import { updateConstellationForDay, getConstellation } from './constellationService'

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k]
  for (const k of Object.keys(centroidDocs)) delete centroidDocs[k]
  computeDayCentroid.mockReset()
})

describe('updateConstellationForDay', () => {
  it('no-ops when the day has no indexed chunks', async () => {
    computeDayCentroid.mockResolvedValue(null)
    await updateConstellationForDay('u1', 100)
    expect(await getConstellation('u1')).toBeNull()
  })

  it('no-ops when the day is below the 750-word threshold', async () => {
    computeDayCentroid.mockResolvedValue({ centroid: [1, 2, 3], wordTotal: 749 })
    await updateConstellationForDay('u1', 100)
    expect(await getConstellation('u1')).toBeNull()
  })

  it('adds one point per qualifying day and bumps the version', async () => {
    store['u1'] = { stats: { streakCount: 4 } }
    computeDayCentroid.mockResolvedValueOnce({ centroid: [0, 0, 0], wordTotal: 800 })
    await updateConstellationForDay('u1', 20000) // 20000 * 86400000 = 2024-10-04 UTC
    computeDayCentroid.mockResolvedValueOnce({ centroid: [10, 0, 0], wordTotal: 751 })
    await updateConstellationForDay('u1', 20001)

    const c = await getConstellation('u1')
    expect(c!.version).toBe(2)
    expect(c!.points).toHaveLength(2)
    expect(c!.points.map(p => p.dayIndex)).toEqual([20000, 20001])
    expect(c!.points[1]).toMatchObject({ date: '2024-10-05', wordCount: 751, streakAtEarn: 4 })
    expect((c!.points[1] as any).vector).toBeUndefined()
  })

  it('removes a day whose total dropped below the threshold and bumps the version', async () => {
    store['u1'] = { stats: { streakCount: 3 } }
    // Two qualifying days earn stars.
    computeDayCentroid.mockResolvedValueOnce({ centroid: [0, 0, 0], wordTotal: 800 })
    await updateConstellationForDay('u1', 20000)
    computeDayCentroid.mockResolvedValueOnce({ centroid: [10, 0, 0], wordTotal: 900 })
    await updateConstellationForDay('u1', 20001)

    let c = await getConstellation('u1')
    expect(c!.version).toBe(2)
    expect(c!.points.map(p => p.dayIndex)).toEqual([20000, 20001])

    // After an edit/delete, day 20001 now falls below 750 → its star is removed.
    computeDayCentroid.mockResolvedValueOnce({ centroid: [10, 0, 0], wordTotal: 700 })
    await updateConstellationForDay('u1', 20001)

    c = await getConstellation('u1')
    expect(c!.version).toBe(3)
    expect(c!.points.map(p => p.dayIndex)).toEqual([20000])
    // Its centroid doc is gone too.
    expect(centroidDocs['u1:20001']).toBeUndefined()
  })

  it('handles a day that drops to null (all chunks purged) by removing its star', async () => {
    store['u1'] = { stats: { streakCount: 1 } }
    computeDayCentroid.mockResolvedValueOnce({ centroid: [0, 0, 0], wordTotal: 800 })
    await updateConstellationForDay('u1', 20000)
    expect((await getConstellation('u1'))!.points).toHaveLength(1)

    computeDayCentroid.mockResolvedValueOnce(null)
    await updateConstellationForDay('u1', 20000)

    const c = await getConstellation('u1')
    expect(c!.version).toBe(2)
    expect(c!.points).toHaveLength(0)
    expect(centroidDocs['u1:20000']).toBeUndefined()
  })

  it('writes nothing when the day neither qualifies nor had a star (no version churn)', async () => {
    computeDayCentroid.mockResolvedValue({ centroid: [1, 2, 3], wordTotal: 500 })
    await updateConstellationForDay('u1', 100)
    expect(await getConstellation('u1')).toBeNull()
    expect(store['u1']).toBeUndefined()
  })
})
