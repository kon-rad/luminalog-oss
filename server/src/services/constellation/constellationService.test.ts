import { describe, it, expect, vi, beforeEach } from 'vitest'

// In-memory Firestore double: users/{uid} doc + constellationCentroids subcollection.
const store: Record<string, any> = {}
const centroidDocs: Record<string, any> = {}

const userDoc = (uid: string) => ({
  async get() { return { data: () => store[uid] } },
  async set(data: any, opts: any) {
    store[uid] = opts?.merge ? { ...store[uid], ...data } : data
  },
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
  it('does nothing when the day has no indexed chunks yet', async () => {
    computeDayCentroid.mockResolvedValue(null)
    await updateConstellationForDay('u1', 100, { date: '2026-07-03', wordCount: 800, streakAtEarn: 1 })
    expect(await getConstellation('u1')).toBeNull()
  })

  it('adds one point per cached day and bumps the version', async () => {
    computeDayCentroid.mockResolvedValueOnce([0, 0, 0])
    await updateConstellationForDay('u1', 100, { date: '2026-07-01', wordCount: 800, streakAtEarn: 1 })
    computeDayCentroid.mockResolvedValueOnce([10, 0, 0])
    await updateConstellationForDay('u1', 101, { date: '2026-07-02', wordCount: 760, streakAtEarn: 2 })

    const c = await getConstellation('u1')
    expect(c!.version).toBe(2)
    expect(c!.points).toHaveLength(2)
    expect(c!.points.map(p => p.dayIndex)).toEqual([100, 101])
    // point-set carries display metadata, never the vector
    expect(c!.points[1]).toMatchObject({ date: '2026-07-02', wordCount: 760, streakAtEarn: 2 })
    expect((c!.points[1] as any).vector).toBeUndefined()
  })
})
