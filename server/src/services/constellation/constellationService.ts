import { db } from '../../middleware/firebaseAuth'
import { computeDayCentroid } from './dayCentroid'
import { pcaTo3D } from './pca'

export interface ConstellationPoint {
  dayIndex: number
  date: string
  x: number
  y: number
  z: number
  wordCount: number
  streakAtEarn: number
}

export interface Constellation {
  version: number
  points: ConstellationPoint[]
}

/**
 * Called when a 750-word badge is earned for `dayIndex`. Computes and caches
 * that day's centroid (server-only), re-runs PCA over ALL cached day-centroids,
 * and persists the fresh point-set on the user doc. Idempotent: re-running for a
 * day already present just recomputes.
 */
export async function updateConstellationForDay(
  userId: string,
  dayIndex: number,
  meta: { date: string; wordCount: number; streakAtEarn: number },
): Promise<void> {
  const centroid = await computeDayCentroid(userId, dayIndex)
  if (!centroid) return // entry not indexed yet — nothing to place

  const userRef = db.collection('users').doc(userId)

  // Cache/refresh this day's centroid (server-only, never published).
  await userRef
    .collection('constellationCentroids')
    .doc(String(dayIndex))
    .set(
      { dayIndex, vector: centroid, date: meta.date, wordCount: meta.wordCount, streakAtEarn: meta.streakAtEarn },
      { merge: true },
    )

  // Load every cached day-centroid in a stable order and recompute the layout.
  const snap = await userRef.collection('constellationCentroids').orderBy('dayIndex').get()
  const rows = snap.docs.map(d => d.data() as {
    dayIndex: number; vector: number[]; date: string; wordCount: number; streakAtEarn: number
  })
  const projected = pcaTo3D(rows.map(r => r.vector))

  const points: ConstellationPoint[] = rows.map((r, i) => ({
    dayIndex: r.dayIndex,
    date: r.date,
    x: projected[i].x,
    y: projected[i].y,
    z: projected[i].z,
    wordCount: r.wordCount,
    streakAtEarn: r.streakAtEarn ?? 0,
  }))

  const prev = (await userRef.get()).data()?.constellation as Constellation | undefined
  const version = (prev?.version ?? 0) + 1
  await userRef.set({ constellation: { version, points } }, { merge: true })
}

/** Read the user's current point-set. Safe to return to the owner. */
export async function getConstellation(userId: string): Promise<Constellation | null> {
  const doc = await db.collection('users').doc(userId).get()
  const c = doc.data()?.constellation as Constellation | undefined
  return c ?? null
}
