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
  // Read the day OUTSIDE the transaction (Chroma, not Firestore).
  const day = await computeDayCentroid(userId, dayIndex)
  const qualifies = day !== null && day.wordTotal >= WORD_TARGET

  const userRef = db.collection('users').doc(userId)
  const centroidsRef = userRef.collection('constellationCentroids')

  await db.runTransaction(async (tx) => {
    // Reads first (Firestore transaction rule): all gets before any writes.
    const userSnap = await tx.get(userRef)
    const centroidsSnap = await tx.get(centroidsRef.orderBy('dayIndex'))

    const prevVersion =
      ((userSnap.data()?.constellation as Constellation | undefined)?.version) ?? 0
    const streakAtEarn =
      ((userSnap.data()?.stats as Record<string, unknown> | undefined)?.streakCount as number) ?? 0

    type CentroidRow = {
      dayIndex: number; vector: number[]; date: string; wordCount: number; streakAtEarn: number
    }
    const existing = centroidsSnap.docs.map(d => d.data() as CentroidRow)
    const hadCentroid = existing.some(d => d.dayIndex === dayIndex)

    // Early no-op: a sub-target day that never had a star needs no write — avoids
    // version churn on every index below the goal.
    if (!qualifies && !hadCentroid) return

    // All rows except this day; add this day back only if it qualifies.
    const rows = existing.filter(r => r.dayIndex !== dayIndex)
    if (qualifies && day) {
      rows.push({
        dayIndex,
        vector: day.centroid,
        date: dateForDayIndex(dayIndex),
        wordCount: day.wordTotal,
        streakAtEarn,
      })
    }
    rows.sort((a, b) => a.dayIndex - b.dayIndex)

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

    // Writes.
    if (qualifies && day) {
      tx.set(
        centroidsRef.doc(String(dayIndex)),
        { dayIndex, vector: day.centroid, date: dateForDayIndex(dayIndex), wordCount: day.wordTotal, streakAtEarn },
        { merge: true },
      )
    } else {
      tx.delete(centroidsRef.doc(String(dayIndex)))
    }
    tx.set(userRef, { constellation: { version: prevVersion + 1, points } }, { merge: true })
  })
}

/** Read the user's current point-set. Safe to return to the owner. */
export async function getConstellation(userId: string): Promise<Constellation | null> {
  const doc = await db.collection('users').doc(userId).get()
  const c = doc.data()?.constellation as Constellation | undefined
  return c ?? null
}
