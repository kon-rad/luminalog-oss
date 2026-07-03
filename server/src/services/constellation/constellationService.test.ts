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

vi.mock('../../middleware/firebaseAuth', () => ({
  db: { collection: () => ({ doc: (uid: string) => userDoc(uid) }) },
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
})
