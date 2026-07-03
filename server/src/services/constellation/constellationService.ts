import { db } from '../../middleware/firebaseAuth'
import { computeDayCentroid } from './dayCentroid'
import { pcaTo3D } from './pca'
import { WORD_TARGET } from '../dailyGoalStreak'

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

/** UTC date string (YYYY-MM-DD) for a day index (days since epoch). */
function dateForDayIndex(dayIndex: number): string {
  return new Date(dayIndex * 86_400_000).toISOString().slice(0, 10)
}

/**
 * Ensure the constellation reflects `dayIndex`. Self-gating and idempotent:
 * computes the day's centroid + total words from indexed chunks; only days at or
 * above the 750-word goal get a star. Works for every entry type (typed text,
 * voice/video transcript, on-device-OCR'd image) because all of them index their
 * text through the same `journals` collection. Recomputes PCA over all cached
 * day-centroids and persists the point-set.
 */
export async function updateConstellationForDay(userId: string, dayIndex: number): Promise<void> {
  const day = await computeDayCentroid(userId, dayIndex)
  if (!day) return
  if (day.wordTotal < WORD_TARGET) return // day hasn't reached the goal — no star

  const userRef = db.collection('users').doc(userId)
  const streakAtEarn = ((await userRef.get()).data()?.stats as Record<string, unknown> | undefined)
    ?.streakCount as number ?? 0

  await userRef
    .collection('constellationCentroids')
    .doc(String(dayIndex))
    .set(
      { dayIndex, vector: day.centroid, date: dateForDayIndex(dayIndex), wordCount: day.wordTotal, streakAtEarn },
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
