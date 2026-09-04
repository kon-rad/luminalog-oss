/**
 * One-time backfill: give every user their zoom-pyramid `periodCentroids`
 * (week/month/quarter/year/lifetime position tiers) for journal days that were
 * indexed BEFORE the feature shipped.
 *
 * `updatePeriodCentroidsForDay` only ever runs as a side effect of `POST
 * /v1/rag/index` and entry delete (see `rag.ts`), so a day indexed before this
 * deploy never got its centroids written, even though its Chroma chunks already
 * carry the `dayIndex` metadata (tagged at index time, or by the earlier
 * `backfillConstellation.ts` run). This script:
 *   1. For each user, reads every Chroma chunk's `dayIndex` metadata (no writes
 *      to Chroma, unlike backfillConstellation, since the tagging already exists)
 *      and collects the distinct set of days that have any indexed content.
 *   2. For each distinct day, calls `updatePeriodCentroidsForDay` (self-gating,
 *      idempotent) to (re)write that day's centroid and roll it up through week,
 *      month, quarter, year, and lifetime.
 *
 * Unlike Soul Constellation, position here is UNGATED (no word-count threshold):
 * every day with any indexed content gets a centroid.
 *
 * SAFE: dry-run by default (reads only, writes nothing). Pass `--live` to write.
 * Idempotent: re-running recomputes the same tiers from the same source chunks.
 * Optional `--user <uid>` limits to one user (for testing).
 *
 *   Dry run (default):  npx tsx src/scripts/backfillPeriodCentroids.ts
 *   One user, live:     npx tsx src/scripts/backfillPeriodCentroids.ts --live --user <uid>
 *   All users, live:    npx tsx src/scripts/backfillPeriodCentroids.ts --live
 */
import 'dotenv/config'
import { db } from '../middleware/firebaseAuth'
import { getJournalsCollection } from '../db/chroma'
import { updatePeriodCentroidsForDay } from '../services/periodCentroid/rollup'

const LIVE = process.argv.includes('--live')
const userIdx = process.argv.indexOf('--user')
const ONLY_USER = userIdx !== -1 ? process.argv[userIdx + 1] : null

interface UserResult {
  uid: string
  chunksScanned: number
  chunksSkippedNoDayIndex: number
  distinctDays: number
}

/** Every distinct `dayIndex` a user has any indexed Chroma chunk for. */
async function distinctDaysForUser(uid: string): Promise<{ days: number[]; result: Omit<UserResult, 'uid' | 'distinctDays'> }> {
  const col = await getJournalsCollection()
  const res = await col.get({
    where: { userId: { $eq: uid } },
    include: ['metadatas'] as any,
  })
  const metas = (res.metadatas ?? []) as Array<{ dayIndex?: number } | null>

  const days = new Set<number>()
  let skipped = 0
  for (const m of metas) {
    if (m && typeof m.dayIndex === 'number') {
      days.add(m.dayIndex)
    } else {
      skipped += 1
    }
  }

  return {
    days: [...days].sort((a, b) => a - b),
    result: { chunksScanned: metas.length, chunksSkippedNoDayIndex: skipped },
  }
}

async function backfillUser(uid: string): Promise<UserResult> {
  const { days, result } = await distinctDaysForUser(uid)

  if (LIVE) {
    for (const d of days) await updatePeriodCentroidsForDay(uid, d)
  }

  return { uid, distinctDays: days.length, ...result }
}

async function main(): Promise<void> {
  console.log(`[backfill-period-centroids] mode=${LIVE ? 'LIVE (writing)' : 'DRY-RUN (read-only)'}${ONLY_USER ? ` user=${ONLY_USER}` : ''}`)

  const userDocs = ONLY_USER
    ? [await db.collection('users').doc(ONLY_USER).get()]
    : (await db.collection('users').get()).docs
  console.log(`[backfill-period-centroids] scanning ${userDocs.length} user(s)`)

  let totalDays = 0
  let usersWithDays = 0

  for (const uDoc of userDocs) {
    if (!uDoc.exists) {
      console.warn(`  user ${uDoc.id}: not found, skipping`)
      continue
    }
    const r = await backfillUser(uDoc.id)
    totalDays += r.distinctDays
    if (r.distinctDays > 0) usersWithDays += 1
    if (r.chunksScanned > 0) {
      console.log(
        `  user ${uDoc.id}: ${r.chunksScanned} chunk(s) -> ${r.distinctDays} distinct day(s)` +
          (r.chunksSkippedNoDayIndex ? `, ${r.chunksSkippedNoDayIndex} chunk(s) skipped (no dayIndex)` : ''),
      )
    }
  }

  console.log(
    `[backfill-period-centroids] ${LIVE ? 'DONE' : 'DRY-RUN complete'}, ` +
      `${totalDays} day(s) across ${usersWithDays} user(s) ${LIVE ? 'recomputed' : 'would be recomputed'}.` +
      (LIVE ? '' : '\n  Re-run with --live to apply.'),
  )
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[backfill-period-centroids] failed', err)
    process.exit(1)
  })
