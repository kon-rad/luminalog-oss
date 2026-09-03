import { describe, it, expect, vi, beforeEach } from 'vitest'

// In-memory Firestore double: one flat map keyed by full doc path, supporting the
// single-field `.where(field, '==', value).get()` this module actually issues, plus
// plain `.doc(id).set/get/delete`. Mirrors the style already used in
// constellationService.test.ts, generalized to arbitrary field/value pairs.
const docs: Record<string, any> = {}

function periodsRef(uid: string) {
  const prefix = `${uid}/`
  return {
    doc(id: string) {
      const key = `${prefix}${id}`
      return {
        async set(data: any) { docs[key] = data },
        async delete() { delete docs[key] },
      }
    },
    where(field: string, _op: '==', value: unknown) {
      return {
        async get() {
          const rows = Object.entries(docs)
            .filter(([k]) => k.startsWith(prefix))
            .map(([, v]) => v)
            .filter(v => v[field] === value)
          return { docs: rows.map(v => ({ data: () => v })) }
        },
      }
    },
  }
}

vi.mock('../../middleware/firebaseAuth', () => ({
  db: {
    collection: () => ({
      doc: (uid: string) => ({ collection: () => periodsRef(uid) }),
    }),
  },
}))

const computeDayCentroid = vi.fn()
vi.mock('../constellation/dayCentroid', () => ({
  computeDayCentroid: (...a: any[]) => computeDayCentroid(...a),
}))

import { meanVector, updatePeriodCentroidsForDay } from './rollup'
import { weekIndexFromDayIndex, monthIndexFromDayIndex, quarterIndexFromDayIndex, yearIndexFromDayIndex } from './periodIndex'

beforeEach(() => {
  for (const k of Object.keys(docs)) delete docs[k]
  computeDayCentroid.mockReset()
})

describe('meanVector', () => {
  it('averages component-wise', () => {
    expect(meanVector([[0, 0, 0], [2, 4, 6], [4, 2, 0]])).toEqual([2, 2, 2])
  })

  it('is a no-op copy for a single vector', () => {
    expect(meanVector([[1, 2, 3]])).toEqual([1, 2, 3])
  })
})

describe('updatePeriodCentroidsForDay', () => {
  const dayIndexFor = (y: number, m: number, d: number) => Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)

  it('does nothing but clear a stale day doc when the day has no chunks', async () => {
    computeDayCentroid.mockResolvedValue(null)
    const day = dayIndexFor(2026, 6, 1)
    docs[`u1/day_${day}`] = { periodType: 'day', periodIndex: day, vector: [1, 1, 1] }

    await updatePeriodCentroidsForDay('u1', day)

    expect(docs[`u1/day_${day}`]).toBeUndefined()
  })

  it('writes a day centroid tagged with its parent tier indices', async () => {
    const day = dayIndexFor(2026, 6, 1)
    computeDayCentroid.mockResolvedValue({ centroid: [1, 2, 3], wordTotal: 500 })

    await updatePeriodCentroidsForDay('u1', day)

    expect(docs[`u1/day_${day}`]).toMatchObject({
      periodType: 'day',
      periodIndex: day,
      vector: [1, 2, 3],
      weekIndex: weekIndexFromDayIndex(day),
      monthIndex: monthIndexFromDayIndex(day),
      quarterIndex: quarterIndexFromDayIndex(day),
      yearIndex: yearIndexFromDayIndex(day),
      childCount: 1,
    })
  })

  it('rolls the mean of two days in the same week up to a week doc', async () => {
    const dayA = dayIndexFor(2026, 6, 1) // Monday
    const dayB = dayIndexFor(2026, 6, 2) // Tuesday, same ISO week
    computeDayCentroid.mockResolvedValueOnce({ centroid: [0, 0, 0], wordTotal: 100 })
    await updatePeriodCentroidsForDay('u1', dayA)
    computeDayCentroid.mockResolvedValueOnce({ centroid: [10, 0, 0], wordTotal: 100 })
    await updatePeriodCentroidsForDay('u1', dayB)

    const week = weekIndexFromDayIndex(dayA)
    expect(docs[`u1/week_${week}`]).toMatchObject({
      periodType: 'week', periodIndex: week, vector: [5, 0, 0], childCount: 2,
    })
  })

  it('rolls all the way up to a single lifetime doc', async () => {
    computeDayCentroid.mockResolvedValue({ centroid: [1, 1, 1], wordTotal: 100 })
    await updatePeriodCentroidsForDay('u1', dayIndexFor(2026, 6, 1))

    expect(docs['u1/lifetime_0']).toMatchObject({
      periodType: 'lifetime', periodIndex: 0, vector: [1, 1, 1], childCount: 1,
    })
  })

  it('removes a week doc whose only day was deleted', async () => {
    const day = dayIndexFor(2026, 6, 1)
    computeDayCentroid.mockResolvedValueOnce({ centroid: [1, 1, 1], wordTotal: 100 })
    await updatePeriodCentroidsForDay('u1', day)
    expect(docs[`u1/week_${weekIndexFromDayIndex(day)}`]).toBeDefined()

    computeDayCentroid.mockResolvedValueOnce(null)
    await updatePeriodCentroidsForDay('u1', day)

    expect(docs[`u1/week_${weekIndexFromDayIndex(day)}`]).toBeUndefined()
  })

  it('scopes rollups per user', async () => {
    const day = dayIndexFor(2026, 6, 1)
    computeDayCentroid.mockResolvedValueOnce({ centroid: [1, 1, 1], wordTotal: 100 })
    await updatePeriodCentroidsForDay('u1', day)
    computeDayCentroid.mockResolvedValueOnce({ centroid: [9, 9, 9], wordTotal: 100 })
    await updatePeriodCentroidsForDay('u2', day)

    expect(docs[`u1/day_${day}`].vector).toEqual([1, 1, 1])
    expect(docs[`u2/day_${day}`].vector).toEqual([9, 9, 9])
  })
})
