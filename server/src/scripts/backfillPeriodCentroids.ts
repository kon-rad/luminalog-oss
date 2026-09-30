/**
 * Re-key the zoom pyramid's `periodCentroids` from UTC days to LOCAL days (profile
 * timezone), for the Story Map (spec docs/superpowers/specs/2026-09-28-story-map-design.md,
 * private workspace). For each user:
 *   1. Reads every journal's `createdAt` and the user's `timezone`, and tags that
 *      entry's Chroma chunks with `localDayIndex` (METADATA ONLY: no re-embedding,
 *      no text, `dayIndex` untouched so the Soul Constellation doesn't move).
 *   2. Deletes every existing `users/{uid}/periodCentroids` doc. All of them were
 *      keyed by UTC day, so none can be kept.
 *   3. Recomputes each local day that has chunks via `updatePeriodCentroidsForDay`
 *      (idempotent), which rolls up week, month, quarter, year and lifetime.
 *
 * SAFE: dry-run by default (reads only, writes nothing). Pass `--live` to write.
 * Idempotent: a re-run re-tags with the same values and recomputes the same tiers.
 * Production data: run `--live --user <uid>` on a test account first, and only with
 * Konrad's go-ahead.
 *
 *   Dry run (default):  npx tsx src/scripts/backfillPeriodCentroids.ts
 *   One user, live:     npx tsx src/scripts/backfillPeriodCentroids.ts --live --user <uid>
 *   All users, live:    npx tsx src/scripts/backfillPeriodCentroids.ts --live
 */
import 'dotenv/config'
import admin from 'firebase-admin'
import { db } from '../middleware/firebaseAuth'
import { getJournalsCollection } from '../db/chroma'
import { updatePeriodCentroidsForDay } from '../services/periodCentroid/rollup'
import { planLocalDays } from '../services/periodCentroid/backfillPlan'

const LIVE = process.argv.includes('--live')
const userIdx = process.argv.indexOf('--user')
const ONLY_USER = userIdx !== -1 ? process.argv[userIdx + 1] : null
const DELETE_BATCH = 400

interface UserResult {
  uid: string
  entries: number
  entriesSkippedNoDate: number
  entriesSkippedNoChunks: number
  chunksTagged: number
  staleDocs: number
  localDays: number
}

/** Tag one entry's chunks with `localDayIndex`. Returns how many chunks it has. */
async function tagEntryChunks(uid: string, entryId: string, localDayIndex: number): Promise<number> {
  const col = await getJournalsCollection()
  const existing = await col.get({
    where: { $and: [{ userId: { $eq: uid } }, { entryId: { $eq: entryId } }] },
    include: ['metadatas'] as any,
  })
  if (existing.ids.length === 0) return 0
  const metas = (existing.metadatas ?? []) as Array<Record<string, unknown>>
  const merged = existing.ids.map((_: string, i: number) => ({ ...(metas[i] ?? {}), localDayIndex }))
  if (LIVE) await col.update({ ids: existing.ids, metadatas: merged })
  return existing.ids.length
}

/** Delete every periodCentroids doc for the user. Returns how many exist. */
async function deleteStaleCentroids(uid: string): Promise<number> {
  const snap = await db.collection('users').doc(uid).collection('periodCentroids').get()
  if (LIVE) {
    for (let i = 0; i < snap.docs.length; i += DELETE_BATCH) {
      const batch = db.batch()
      for (const d of snap.docs.slice(i, i + DELETE_BATCH)) batch.delete(d.ref)
      await batch.commit()
    }
  }
  return snap.size
}

async function backfillUser(uid: string, timeZone: string | undefined): Promise<UserResult> {
  const journals = await db.collection('journals').where('userId', '==', uid).get()
  const plan = planLocalDays(
    journals.docs.map((d: any) => ({
      id: d.id,
      createdAt: (d.data().createdAt as admin.firestore.Timestamp | undefined)?.toDate() ?? null,
    })),
    timeZone,
  )

  let chunksTagged = 0
  let entriesSkippedNoChunks = 0
  const daysWithChunks = new Set<number>()
  for (const [entryId, localDay] of plan.localDayByEntry) {
    const n = await tagEntryChunks(uid, entryId, localDay)
    if (n === 0) {
      entriesSkippedNoChunks += 1
      continue
    }
    chunksTagged += n
    daysWithChunks.add(localDay)
  }

  const staleDocs = await deleteStaleCentroids(uid)
  const days = Array.from(daysWithChunks).sort((a, b) => a - b)
  if (LIVE) {
    for (const d of days) await updatePeriodCentroidsForDay(uid, d)
  }

  return {
    uid,
    entries: journals.size,
    entriesSkippedNoDate: plan.skippedNoDate,
    entriesSkippedNoChunks,
    chunksTagged,
    staleDocs,
    localDays: days.length,
  }
}

async function main(): Promise<void> {
  console.log(`[backfill-period-centroids] mode=${LIVE ? 'LIVE (writing)' : 'DRY-RUN (read-only)'}${ONLY_USER ? ` user=${ONLY_USER}` : ''}`)

  const userDocs = ONLY_USER
    ? [await db.collection('users').doc(ONLY_USER).get()]
    : (await db.collection('users').get()).docs
  console.log(`[backfill-period-centroids] scanning ${userDocs.length} user(s)`)

  let totalChunks = 0
  let totalStale = 0
  let totalDays = 0

  for (const uDoc of userDocs) {
    if (!uDoc.exists) {
      console.warn(`  user ${uDoc.id}: not found, skipping`)
      continue
    }
    const r = await backfillUser(uDoc.id, uDoc.data()?.timezone as string | undefined)
    totalChunks += r.chunksTagged
    totalStale += r.staleDocs
    totalDays += r.localDays
    if (r.entries > 0 || r.staleDocs > 0) {
      console.log(
        `  user ${r.uid}: ${r.entries} entries, ${r.chunksTagged} chunk(s) to tag, ` +
          `${r.staleDocs} stale doc(s), ${r.localDays} local day(s)` +
          (r.entriesSkippedNoChunks ? `, ${r.entriesSkippedNoChunks} no-chunk` : '') +
          (r.entriesSkippedNoDate ? `, ${r.entriesSkippedNoDate} no-date` : ''),
      )
    }
  }

  console.log(
    `[backfill-period-centroids] ${LIVE ? 'DONE' : 'DRY-RUN complete'}: ` +
      `${totalChunks} chunk(s) ${LIVE ? 'tagged' : 'would be tagged'}, ` +
      `${totalStale} stale doc(s) ${LIVE ? 'deleted' : 'would be deleted'}, ` +
      `${totalDays} local day(s) ${LIVE ? 'recomputed' : 'would be recomputed'}.` +
      (LIVE ? '' : '\n  Re-run with --live to apply.'),
  )
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[backfill-period-centroids] failed', err)
    process.exit(1)
  })
