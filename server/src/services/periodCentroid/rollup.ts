import { db } from '../../middleware/firebaseAuth'
import { computeDayCentroid } from '../constellation/dayCentroid'
import { pcaTo3D } from '../constellation/pca'
import {
  type PeriodType, LIFETIME_INDEX,
  weekIndexFromDayIndex, monthIndexFromDayIndex, quarterIndexFromDayIndex, yearIndexFromDayIndex,
  thursdayDayIndexFromDayIndex,
} from './periodIndex'

interface PeriodCentroidDoc {
  periodType: PeriodType
  periodIndex: number
  vector: number[]
  weekIndex?: number
  monthIndex?: number
  quarterIndex?: number
  yearIndex?: number
  childCount: number
  computedAt: string
}

/** Component-wise mean of one or more equal-length vectors. */
export function meanVector(vectors: number[][]): number[] {
  if (vectors.length === 0) return []
  const d = vectors[0]!.length
  const mean = new Array<number>(d).fill(0)
  for (const v of vectors) for (let j = 0; j < d; j++) mean[j] += v[j]!
  for (let j = 0; j < d; j++) mean[j] /= vectors.length
  return mean
}

function periodsCollection(userId: string) {
  return db.collection('users').doc(userId).collection('periodCentroids')
}

/** All centroid docs of `childTier` for this user whose stored field matches. */
async function childVectors(
  userId: string,
  childTier: PeriodType,
  field: string,
  value: number,
): Promise<number[][]> {
  const snap = await periodsCollection(userId).where('periodType', '==', childTier).get()
  return snap.docs
    .map((d: any) => d.data() as PeriodCentroidDoc)
    .filter((row: PeriodCentroidDoc) => (row as any)[field] === value)
    .map((row: PeriodCentroidDoc) => row.vector)
}

/** Every year doc for this user, unfiltered (lifetime has no parent to filter by). */
async function allVectorsOfTier(userId: string, tier: PeriodType): Promise<number[][]> {
  const snap = await periodsCollection(userId).where('periodType', '==', tier).get()
  return snap.docs.map((d: any) => (d.data() as PeriodCentroidDoc).vector)
}

/** Overwrite a tier's centroid doc from its children, or delete it if none remain. */
async function writeOrDeleteTier(
  userId: string,
  tier: PeriodType,
  periodIndex: number,
  vectors: number[][],
  parentFields: Partial<Pick<PeriodCentroidDoc, 'monthIndex' | 'quarterIndex' | 'yearIndex'>>,
): Promise<void> {
  const ref = periodsCollection(userId).doc(`${tier}_${periodIndex}`)
  if (vectors.length === 0) {
    await ref.delete()
    return
  }
  await ref.set({
    periodType: tier,
    periodIndex,
    vector: meanVector(vectors),
    childCount: vectors.length,
    computedAt: new Date().toISOString(),
    ...parentFields,
  })
}

/**
 * Recompute one day's centroid and every tier above it (week, month, quarter, year,
 * lifetime), fully from source of truth each time. Idempotent and self-gating like
 * `updateConstellationForDay`: a day with no indexed chunks clears its doc (and any
 * tier left with no children clears too), never leaving a stale row behind.
 *
 * STATELESS input, PERSISTENT output: reads Chroma's stored vectors (never decrypts
 * text) and writes only to `users/{userId}/periodCentroids`, a server-only collection
 * mirroring `constellationCentroids`'s privacy posture (see the design spec).
 */
export async function updatePeriodCentroidsForDay(userId: string, dayIndex: number): Promise<void> {
  const week = weekIndexFromDayIndex(dayIndex)
  const month = monthIndexFromDayIndex(dayIndex)
  const quarter = quarterIndexFromDayIndex(dayIndex)
  const year = yearIndexFromDayIndex(dayIndex)

  const weekAnchorDay = thursdayDayIndexFromDayIndex(dayIndex)
  const weekMonth = monthIndexFromDayIndex(weekAnchorDay)
  const weekQuarter = quarterIndexFromDayIndex(weekAnchorDay)
  const weekYear = yearIndexFromDayIndex(weekAnchorDay)

  const day = await computeDayCentroid(userId, dayIndex)
  const dayRef = periodsCollection(userId).doc(`day_${dayIndex}`)
  if (day === null) {
    await dayRef.delete()
  } else {
    await dayRef.set({
      periodType: 'day',
      periodIndex: dayIndex,
      vector: day.centroid,
      weekIndex: week,
      monthIndex: month,
      quarterIndex: quarter,
      yearIndex: year,
      childCount: 1,
      computedAt: new Date().toISOString(),
    })
  }

  await writeOrDeleteTier(
    userId, 'week', week,
    await childVectors(userId, 'day', 'weekIndex', week),
    { monthIndex: weekMonth, quarterIndex: weekQuarter, yearIndex: weekYear },
  )
  await writeOrDeleteTier(
    userId, 'month', month,
    await childVectors(userId, 'week', 'monthIndex', month),
    { quarterIndex: quarter, yearIndex: year },
  )
  await writeOrDeleteTier(
    userId, 'quarter', quarter,
    await childVectors(userId, 'month', 'quarterIndex', quarter),
    { yearIndex: year },
  )
  await writeOrDeleteTier(
    userId, 'year', year,
    await childVectors(userId, 'quarter', 'yearIndex', year),
    {},
  )
  await writeOrDeleteTier(
    userId, 'lifetime', LIFETIME_INDEX,
    await allVectorsOfTier(userId, 'year'),
    {},
  )
}

export interface PeriodPositionPoint {
  periodIndex: number
  x: number
  y: number
  z: number
  childCount: number
}

/**
 * All of a user's centroid points for one tier, PCA-projected together so their
 * relative positions are meaningful, sorted oldest-first. Never returns the raw
 * `vector` field: this is the only read path a client-facing route should call.
 */
export async function getPeriodPositions(
  userId: string,
  periodType: PeriodType,
): Promise<PeriodPositionPoint[]> {
  const snap = await periodsCollection(userId).where('periodType', '==', periodType).get()
  const rows = snap.docs
    .map((d: any) => d.data() as PeriodCentroidDoc)
    .sort((a: PeriodCentroidDoc, b: PeriodCentroidDoc) => a.periodIndex - b.periodIndex)
  if (rows.length === 0) return []

  const projected = pcaTo3D(rows.map((r: PeriodCentroidDoc) => r.vector))
  return rows.map((r: PeriodCentroidDoc, i: number) => ({
    periodIndex: r.periodIndex,
    x: projected[i]!.x,
    y: projected[i]!.y,
    z: projected[i]!.z,
    childCount: r.childCount,
  }))
}
