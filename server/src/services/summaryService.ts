import admin from 'firebase-admin'
import { db } from '../middleware/firebaseAuth'
import { generateSummaryText } from './summaryGenerator'
import { indexSummary } from './summaryIndexer'
import { encryptField } from '../crypto/fieldCipher'

/** Regenerate when forced, when there is no summary, or when content was edited
 *  after the summary was generated (stale). */
export function shouldRegenerateSummary(
  data: admin.firestore.DocumentData,
  force: boolean | undefined,
): boolean {
  if (force) return true
  const summary = data.summary as { generatedAt?: admin.firestore.Timestamp } | undefined
  if (!summary?.generatedAt) return true
  const editedAt = data.contentEditedAt as admin.firestore.Timestamp | undefined
  if (editedAt && editedAt.toMillis() > summary.generatedAt.toMillis()) return true
  return false
}

/**
 * Ensure an entry's summary text + summary vector are up to date.
 *
 * This is the single source of truth for summary generation/indexing, shared by
 * every content-indexing path (`/v1/rag/index` and `/v1/ai/transcribe`). Voice
 * and video entries reach the server only through transcription, so without a
 * shared helper here those entries never get a summary vector — which silently
 * breaks the constellation graph and the "Related" tab (both read the
 * `journal_summaries` collection).
 *
 * Persists the summary text to Firestore BEFORE indexing the vector, so the text
 * is valid even if embedding fails. Throws on failure; callers decide whether a
 * summary failure should fail their request (content/transcript is kept either way).
 *
 * @returns whether the entry now has an indexed summary vector.
 */
export async function ensureEntrySummaryIndexed(params: {
  uid: string
  journalId: string
  data: admin.firestore.DocumentData
  content: string
  title: string
  type: string
  date: string
  dek: Buffer
  force?: boolean
}): Promise<boolean> {
  const { uid, journalId, data, content, title, type, date, dek, force } = params

  if (!shouldRegenerateSummary(data, force)) {
    return data.vector?.summaryIndexed === true
  }

  const userConfig = (await db.collection('users').doc(uid).get()).data()?.summaryConfig
  const summary = await generateSummaryText({ type, content, userConfig })

  await db.collection('journals').doc(journalId).update({
    summary: {
      text: encryptField(dek, summary.text, 'journals.summary.text'),
      generatedAt: admin.firestore.Timestamp.fromDate(new Date(summary.generatedAt)),
      model: summary.model,
    },
  })

  await indexSummary({ userId: uid, entryId: journalId, summaryText: summary.text, type, title, date, dek })
  return true
}
