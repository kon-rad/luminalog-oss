/**
 * One-time backfill: give every user their Soul Constellation stars for
 * 750-word days that occurred BEFORE the constellation feature shipped.
 *
 * Pre-feature journal chunks in Chroma have no `dayIndex`/`wordCount` metadata,
 * so `computeDayCentroid` never matched them and no historical day earned a star.
 * This script:
 *   1. For each user's journal entry, updates its existing Chroma chunks'
 *      METADATA to add `dayIndex` (from the entry's createdAt + the user's
 *      timezone) and `wordCount` (the entry's stored count). It does NOT
 *      re-embed — no AI cost, embeddings are untouched.
 *   2. For each distinct day that reaches the 750-word goal, calls
 *      `updateConstellationForDay` (self-gating, idempotent) to place the star.
 *
 * SAFE: dry-run by default (reads only, writes nothing). Pass `--live` to write.
 * Idempotent: re-running re-tags with identical values and re-runs the
 * idempotent recompute. Optional `--user <uid>` limits to one user (for testing).
 *
 *   Dry run (default):  npx tsx src/scripts/backfillConstellation.ts
 *   One user, live:     npx tsx src/scripts/backfillConstellation.ts --live --user <uid>
 *   All users, live:    npx tsx src/scripts/backfillConstellation.ts --live
 */
import 'dotenv/config'
import admin from 'firebase-admin'
import { db } from '../middleware/firebaseAuth'
import { getJournalsCollection } from '../db/chroma'
import { dayIndex, WORD_TARGET } from '../services/dailyGoalStreak'
import { updateConstellationForDay } from '../services/constellation/constellationService'

const LIVE = process.argv.includes('--live')
const userIdx = process.argv.indexOf('--user')
const ONLY_USER = userIdx !== -1 ? process.argv[userIdx + 1] : null

interface UserResult {
  uid: string
  entriesTagged: number
  entriesSkippedNoChunks: number
  entriesSkippedNoDate: number
  qualifyingDays: number
}

/** Tag one entry's Chroma chunks with dayIndex + wordCount (metadata only). */
async function tagEntryChunks(
  uid: string,
  entryId: string,
  dIdx: number,
  wordCount: number,
): Promise<number> {
  const col = await getJournalsCollection()
  const existing = await col.get({
    where: { $and: [{ userId: { $eq: uid } }, { entryId: { $eq: entryId } }] },
    include: ['metadatas'] as any,
  })
  if (!existing.ids.length) return 0
  const metas = (existing.metadatas ?? []) as Array<Record<string, unknown>>
  const merged = existing.ids.map((_, i) => ({ ...(metas[i] ?? {}), dayIndex: dIdx, wordCount }))
  if (LIVE) await col.update({ ids: existing.ids, metadatas: merged })
  return existing.ids.length
}

async function backfillUser(uid: string, timeZone: string): Promise<UserResult> {
  const res: UserResult = {
    uid,
    entriesTagged: 0,
    entriesSkippedNoChunks: 0,
    entriesSkippedNoDate: 0,
    qualifyingDays: 0,
  }
  const perDayWords = new Map<number, number>() // dayIndex -> summed entry words (dedup: one entry once)

  const journals = await db.collection('journals').where('userId', '==', uid).get()
  for (const jDoc of journals.docs) {
    const data = jDoc.data()
    const createdAt = (data.createdAt as admin.firestore.Timestamp | undefined)?.toDate()
    if (!createdAt) {
      res.entriesSkippedNoDate += 1
      continue
    }
    const wordCount = (data.wordCount as number) ?? 0
    const dIdx = dayIndex(createdAt, timeZone)

    const tagged = await tagEntryChunks(uid, jDoc.id, dIdx, wordCount)
    if (tagged === 0) {
      res.entriesSkippedNoChunks += 1
      continue
    }
    res.entriesTagged += 1
    perDayWords.set(dIdx, (perDayWords.get(dIdx) ?? 0) + wordCount)
  }

  // Recompute only days that actually reach the goal (self-gating handles the rest).
  const qualifyingDays = [...perDayWords.entries()]
    .filter(([, words]) => words >= WORD_TARGET)
    .map(([d]) => d)
    .sort((a, b) => a - b)
  res.qualifyingDays = qualifyingDays.length

  if (LIVE) {
    for (const d of qualifyingDays) await updateConstellationForDay(uid, d)
  }
  return res
}

async function main(): Promise<void> {
  console.log(`[backfill-constellation] mode=${LIVE ? 'LIVE (writing)' : 'DRY-RUN (read-only)'}${ONLY_USER ? ` user=${ONLY_USER}` : ''}`)

  const userDocs = ONLY_USER
    ? [await db.collection('users').doc(ONLY_USER).get()]
    : (await db.collection('users').get()).docs
  console.log(`[backfill-constellation] scanning ${userDocs.length} user(s)`)

  let totalTagged = 0
  let totalDays = 0
  let usersWithStars = 0

  for (const uDoc of userDocs) {
    if (!uDoc.exists) {
      console.warn(`  user ${uDoc.id}: not found, skipping`)
      continue
    }
    const timeZone = (uDoc.data()?.timezone as string) || 'UTC'
    const r = await backfillUser(uDoc.id, timeZone)
    totalTagged += r.entriesTagged
    totalDays += r.qualifyingDays
    if (r.qualifyingDays > 0) usersWithStars += 1
    if (r.entriesTagged > 0 || r.qualifyingDays > 0) {
      console.log(
        `  user ${uDoc.id}: tagged ${r.entriesTagged} entries → ${r.qualifyingDays} star day(s)` +
          (r.entriesSkippedNoChunks ? `, ${r.entriesSkippedNoChunks} no-chunk` : '') +
          (r.entriesSkippedNoDate ? `, ${r.entriesSkippedNoDate} no-date` : ''),
      )
    }
  }

  console.log(
    `[backfill-constellation] ${LIVE ? 'DONE' : 'DRY-RUN complete'} — ` +
      `${totalTagged} entries ${LIVE ? 'tagged' : 'would tag'}, ` +
      `${totalDays} star day(s) across ${usersWithStars} user(s) ${LIVE ? 'created' : 'would be created'}.` +
      (LIVE ? '' : '\n  Re-run with --live to apply.'),
  )
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[backfill-constellation] failed', err)
    process.exit(1)
  })
