import { db } from '../../middleware/firebaseAuth'
import { dayIndex } from '../dailyGoalStreak'

/**
 * The zoom pyramid's day key for an entry: its calendar day in the user's profile
 * timezone, the same day the iOS period summaries file it under. `dayIndex`
 * sanitizes the zone, so a missing or bad zone means UTC (the pyramid's old
 * behaviour). Falls back to `fallbackDayIndex` (the client's UTC day) with no
 * timestamp. Spec: docs/superpowers/specs/2026-09-28-story-map-design.md.
 */
export function localDayFor(
  createdAt: Date | null,
  timeZone: string | null | undefined,
  fallbackDayIndex: number,
): number {
  if (!createdAt || Number.isNaN(createdAt.getTime())) return fallbackDayIndex
  return dayIndex(createdAt, timeZone ?? 'UTC')
}

/**
 * Reads `journals/{entryId}.createdAt` and `users/{userId}.timezone` (both
 * plaintext) and returns the entry's local day. Never throws: any miss (no doc,
 * someone else's entry, no timestamp, a Firestore error) returns the fallback, so
 * indexing never fails over a position key.
 */
export async function resolveEntryLocalDay(
  userId: string,
  entryId: string,
  fallbackDayIndex: number,
): Promise<number> {
  try {
    const [entrySnap, userSnap] = await Promise.all([
      db.collection('journals').doc(entryId).get(),
      db.collection('users').doc(userId).get(),
    ])
    const entry = entrySnap.exists ? entrySnap.data() : undefined
    if (!entry || entry.userId !== userId) return fallbackDayIndex
    const createdAt = typeof entry.createdAt?.toDate === 'function' ? (entry.createdAt.toDate() as Date) : null
    const timeZone = userSnap.exists ? (userSnap.data()?.timezone as string | undefined) : undefined
    return localDayFor(createdAt, timeZone, fallbackDayIndex)
  } catch (e) {
    console.error('[periodCentroid] local day lookup failed', { entryId }, e)
    return fallbackDayIndex
  }
}
