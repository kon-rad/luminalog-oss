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
 *   4. Re-reads the user's distinct chunk local days and recomputes any day not in
 *      the step-3 set once (a live index racing the delete can otherwise lose its day).
 *
 * SAFE: dry-run by default (reads only, writes nothing). Pass `--live` to write.
 * Idempotent: a re-run re-tags with the same values and recomputes the same tiers.
 * Entries with no usable `createdAt` fall back to each chunk's existing `dayIndex`
 * (the UTC day, matching the index-time fallback) and are counted as fallbackToUtcDay.
 * Failure: the run STOPS at the first failing user and exits non-zero. Step 2 deletes
 * before step 3 recomputes, so a failure after the delete leaves that user's pyramid
 * partial; recovery is re-running the same user (`--live --user <uid>`), which is idempotent.
 * Production data: run `--live --user <uid>` on a test account first, and only with
 * Konrad's go-ahead.
 *
 *   Dry run (default):  npx tsx src/scripts/backfillPeriodCentroids.ts
 *   One user, live:     npx tsx src/scripts/backfillPeriodCentroids.ts --live --user <uid>
 *   All users, live:    npx tsx src/scripts/backfillPeriodCentroids.ts --live
 */
import 'dotenv/config'
import { db } from '../middleware/firebaseAuth'
import { getJournalsCollection } from '../db/chroma'
import { updatePeriodCentroidsForDay } from '../services/periodCentroid/rollup'
import { planLocalDays, daysAddedSince } from '../services/periodCentroid/backfillPlan'

import { parseBackfillArgs } from './backfillArgs'

// Parse before any database access: a bad flag must never fall through to all users.
const parsed = parseBackfillArgs(process.argv.slice(2))
if ('error' in parsed) {
  console.error(`[backfill-period-centroids] ${parsed.error}`)
  process.exit(1)
}
const LIVE = parsed.live
const ONLY_USER = parsed.onlyUser
const DELETE_BATCH = 400

interface UserResult {
  uid: string
  entries: number
  fallbackToUtcDay: number
  entriesSkippedNoChunks: number
  chunksTagged: number
  staleDocs: number
  localDays: number
  /** Days picked up by the post-recompute race pass (LIVE only). */
  lateDays: number
}

/**
 * Tag one entry's chunks with `localDayIndex`. A null `localDay` means the entry has
 * no usable date: each chunk falls back to its own existing `dayIndex`. Returns the
 * chunk count and the distinct days tagged.
 */
async function tagEntryChunks(
  uid: string,
  entryId: string,
  localDay: number | null,
): Promise<{ chunks: number; days: number[] }> {
  const col = await getJournalsCollection()
  const existing = await col.get({
    where: { $and: [{ userId: { $eq: uid } }, { entryId: { $eq: entryId } }] },
    include: ['metadatas'] as any,
  })
  if (existing.ids.length === 0) return { chunks: 0, days: [] }
  const metas = (existing.metadatas ?? []) as Array<Record<string, unknown>>
  const ids: string[] = []
  const merged: Array<Record<string, unknown>> = []
  const days = new Set<number>()
  existing.ids.forEach((id: string, i: number) => {
    const meta = metas[i] ?? {}
    const day = localDay ?? (typeof meta.dayIndex === 'number' ? meta.dayIndex : null)
    if (day === null) return
    ids.push(id)
    merged.push({ ...meta, localDayIndex: day })
    days.add(day)
  })
  if (LIVE && ids.length > 0) await col.update({ ids, metadatas: merged as any })
  return { chunks: ids.length, days: Array.from(days) }
}

/** Every `localDayIndex` value on the user's chunks (metadata only, userId-scoped). */
async function currentChunkLocalDays(uid: string): Promise<unknown[]> {
  const col = await getJournalsCollection()
  const res = await col.get({
    where: { userId: { $eq: uid } },
    include: ['metadatas'] as any,
  })
  return ((res.metadatas ?? []) as Array<Record<string, unknown> | null>).map(m => m?.localDayIndex)
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

class UserRunError extends Error {
  constructor(public afterDelete: boolean, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause))
  }
}

async function backfillUser(uid: string, timeZone: string | undefined): Promise<UserResult> {
  // Set just before the delete starts: a delete that fails midway may have committed
  // some batches, so it counts as partial too.
  let afterDelete = false
  try {
    const journals = await db.collection('journals').where('userId', '==', uid).get()
    const plan = planLocalDays(
      journals.docs.map((d: any) => {
        const ts = d.data().createdAt
        return { id: d.id, createdAt: typeof ts?.toDate === 'function' ? (ts.toDate() as Date) : null }
      }),
      timeZone,
    )

    let chunksTagged = 0
    let entriesSkippedNoChunks = 0
    let fallbackToUtcDay = 0
    const daysWithChunks = new Set<number>()
    const work: Array<[string, number | null]> = [
      ...Array.from(plan.localDayByEntry.entries()),
      ...plan.noDateEntryIds.map((id): [string, number | null] => [id, null]),
    ]
    for (const [entryId, localDay] of work) {
      const r = await tagEntryChunks(uid, entryId, localDay)
      if (r.chunks === 0) {
        entriesSkippedNoChunks += 1
        continue
      }
      if (localDay === null) fallbackToUtcDay += 1
      chunksTagged += r.chunks
      for (const d of r.days) daysWithChunks.add(d)
    }

    if (LIVE) afterDelete = true
    const staleDocs = await deleteStaleCentroids(uid)
    const days = Array.from(daysWithChunks).sort((a, b) => a - b)
    let lateDays: number[] = []
    if (LIVE) {
      for (const d of days) await updatePeriodCentroidsForDay(uid, d)
      // One extra pass for days a concurrent live index added after the scan.
      lateDays = daysAddedSince(days, await currentChunkLocalDays(uid))
      for (const d of lateDays) await updatePeriodCentroidsForDay(uid, d)
    }

    return {
      uid,
      entries: journals.size,
      fallbackToUtcDay,
      entriesSkippedNoChunks,
      chunksTagged,
      staleDocs,
      localDays: days.length + lateDays.length,
      lateDays: lateDays.length,
    }
  } catch (err) {
    throw new UserRunError(afterDelete, err)
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
    let r: UserResult
    try {
      r = await backfillUser(uDoc.id, uDoc.data()?.timezone as string | undefined)
    } catch (err) {
      const e = err as UserRunError
      console.error(
        e.afterDelete
          ? `user ${uDoc.id}: pyramid PARTIAL after delete, re-run --live --user ${uDoc.id}`
          : `user ${uDoc.id}: failed before the centroid delete (Chroma tags may be partly applied; re-run is safe)`,
      )
      console.error(`  cause: ${e.message}`)
      process.exit(1)
    }
    totalChunks += r.chunksTagged
    totalStale += r.staleDocs
    totalDays += r.localDays
    if (r.entries > 0 || r.staleDocs > 0) {
      console.log(
        `  user ${r.uid}: ${r.entries} entries, ${r.chunksTagged} chunk(s) to tag, ` +
          `${r.staleDocs} stale doc(s), ${r.localDays} local day(s)` +
          (r.entriesSkippedNoChunks ? `, ${r.entriesSkippedNoChunks} no-chunk` : '') +
          (r.fallbackToUtcDay ? `, fallbackToUtcDay: ${r.fallbackToUtcDay}` : '') +
          (r.lateDays ? `, ${r.lateDays} late day(s) recomputed` : ''),
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
