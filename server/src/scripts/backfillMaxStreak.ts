/**
 * One-time backfill: seed `stats.maxStreakCount` = max(existing, streakCount)
 * for every user so existing docs appear in the leaderboard's ordered query
 * (Firestore excludes docs missing the orderBy field).
 *
 * Run once after deploy:  npx tsx src/scripts/backfillMaxStreak.ts
 */
import 'dotenv/config'
import { db } from '../middleware/firebaseAuth'

async function main(): Promise<void> {
  const snap = await db.collection('users').get()
  console.log(`[backfill] scanning ${snap.size} users`)

  let updated = 0
  let batch = db.batch()
  let pending = 0

  for (const doc of snap.docs) {
    const stats = (doc.data().stats as Record<string, unknown>) ?? {}
    const current = (stats.maxStreakCount as number) ?? 0
    const streak = (stats.streakCount as number) ?? 0
    const seed = Math.max(current, streak)
    if (seed === current && stats.maxStreakCount !== undefined) continue

    batch.set(doc.ref, { stats: { maxStreakCount: seed } }, { merge: true })
    updated += 1
    pending += 1
    if (pending === 400) {
      await batch.commit()
      batch = db.batch()
      pending = 0
    }
  }
  if (pending > 0) await batch.commit()
  console.log(`[backfill] set maxStreakCount on ${updated} users`)
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[backfill] failed', err)
    process.exit(1)
  })
