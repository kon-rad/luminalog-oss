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

const pcaTo3D = vi.fn((vectors: number[][]) => vectors.map((v, i) => ({ x: v[0] ?? 0, y: v[1] ?? 0, z: v[2] ?? 0 })))
vi.mock('../constellation/pca', () => ({
  pcaTo3D: (vectors: number[][]) => pcaTo3D(vectors),
}))

import { meanVector, updatePeriodCentroidsForDay, getPeriodPositions } from './rollup'
import {
  weekIndexFromDayIndex, monthIndexFromDayIndex, quarterIndexFromDayIndex, yearIndexFromDayIndex,
  thursdayDayIndexFromDayIndex,
} from './periodIndex'

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

  it('returns an empty array for an empty input', () => {
    expect(meanVector([])).toEqual([])
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

  it('does not create stale month docs when an ISO week straddles calendar months', async () => {
    // 2026-06-29 (Mon) is in June but in an ISO week whose Thursday (2026-07-02) is in July.
    // The week doc should be tagged with July's month, not June's.
    const dayLateJune = dayIndexFor(2026, 6, 29)
    computeDayCentroid.mockResolvedValueOnce({ centroid: [1, 1, 1], wordTotal: 100 })
    await updatePeriodCentroidsForDay('u1', dayLateJune)

    // 2026-07-01 (Wed) is in July and in the same ISO week. Updating it should not
    // retroactively create or modify a June month doc.
    const dayEarlyJuly = dayIndexFor(2026, 7, 1)
    computeDayCentroid.mockResolvedValueOnce({ centroid: [2, 2, 2], wordTotal: 100 })
    await updatePeriodCentroidsForDay('u1', dayEarlyJuly)

    // The week doc should exist and be tagged with July (not June).
    const week = weekIndexFromDayIndex(dayLateJune)
    expect(docs[`u1/week_${week}`]).toBeDefined()
    expect(docs[`u1/week_${week}`].monthIndex).toBe(monthIndexFromDayIndex(dayIndexFor(2026, 7, 2)))

    // June's month doc should not exist (no days in June contributed to it).
    const juneMonth = monthIndexFromDayIndex(dayLateJune)
    const juneMonthKey = `u1/month_${juneMonth}`
    expect(docs[juneMonthKey]).toBeUndefined()
  })

  it('rolls up to the week-anchor month/quarter/year/lifetime after only the minority-side day', async () => {
    // 2026-06-29 (Mon) is in June, but its ISO week's Thursday (2026-07-02) is in July.
    // Process ONLY this single minority-side day (no follow-up majority-side day) and
    // assert the month/quarter/year/lifetime tiers are already rolled up using the
    // week's anchor (July) attribution, not the day's own (June) attribution.
    const dayLateJune = dayIndexFor(2026, 6, 29)
    computeDayCentroid.mockResolvedValueOnce({ centroid: [1, 1, 1], wordTotal: 100 })
    await updatePeriodCentroidsForDay('u1', dayLateJune)

    const weekAnchorDay = thursdayDayIndexFromDayIndex(dayLateJune)
    const anchorMonth = monthIndexFromDayIndex(weekAnchorDay)
    const anchorQuarter = quarterIndexFromDayIndex(weekAnchorDay)
    const anchorYear = yearIndexFromDayIndex(weekAnchorDay)

    expect(docs[`u1/month_${anchorMonth}`]).toMatchObject({
      periodType: 'month', periodIndex: anchorMonth, vector: [1, 1, 1], childCount: 1,
      quarterIndex: anchorQuarter, yearIndex: anchorYear,
    })
    expect(docs[`u1/quarter_${anchorQuarter}`]).toMatchObject({
      periodType: 'quarter', periodIndex: anchorQuarter, vector: [1, 1, 1], childCount: 1,
      yearIndex: anchorYear,
    })
    expect(docs[`u1/year_${anchorYear}`]).toMatchObject({
      periodType: 'year', periodIndex: anchorYear, vector: [1, 1, 1], childCount: 1,
    })
    expect(docs['u1/lifetime_0']).toMatchObject({
      periodType: 'lifetime', periodIndex: 0, vector: [1, 1, 1], childCount: 1,
    })

    // The day's own (June) month should NOT have been used as the rollup key.
    const juneMonth = monthIndexFromDayIndex(dayLateJune)
    if (juneMonth !== anchorMonth) {
      expect(docs[`u1/month_${juneMonth}`]).toBeUndefined()
    }
  })
})

describe('getPeriodPositions', () => {
  it('returns an empty array when the tier has no docs', async () => {
    expect(await getPeriodPositions('u1', 'week')).toEqual([])
  })

  it('never exposes the raw vector, only the projected position', async () => {
    const day = Math.floor(Date.UTC(2026, 5, 1) / 86_400_000)
    computeDayCentroid.mockResolvedValue({ centroid: [1, 2, 3], wordTotal: 100 })
    await updatePeriodCentroidsForDay('u1', day)

    const points = await getPeriodPositions('u1', 'day')
    expect(points).toHaveLength(1)
    expect(points[0]).toMatchObject({ periodIndex: day, childCount: 1 })
    expect(points[0]).not.toHaveProperty('vector')
    expect(typeof points[0]!.x).toBe('number')
  })

  it('sorts points by periodIndex ascending', async () => {
    const dayA = Math.floor(Date.UTC(2026, 5, 1) / 86_400_000)
    const dayB = Math.floor(Date.UTC(2026, 5, 20) / 86_400_000)
    computeDayCentroid.mockResolvedValueOnce({ centroid: [1, 0, 0], wordTotal: 100 })
    await updatePeriodCentroidsForDay('u1', dayB)
    computeDayCentroid.mockResolvedValueOnce({ centroid: [0, 1, 0], wordTotal: 100 })
    await updatePeriodCentroidsForDay('u1', dayA)

    const points = await getPeriodPositions('u1', 'day')
    expect(points.map(p => p.periodIndex)).toEqual([dayA, dayB])
  })

  it('scopes to one user', async () => {
    const day = Math.floor(Date.UTC(2026, 5, 1) / 86_400_000)
    computeDayCentroid.mockResolvedValueOnce({ centroid: [1, 0, 0], wordTotal: 100 })
    await updatePeriodCentroidsForDay('u1', day)

    expect(await getPeriodPositions('u2', 'day')).toEqual([])
  })
})
