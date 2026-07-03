import admin from 'firebase-admin'
import { db } from '../middleware/firebaseAuth'
import { generateEntryAI } from './summaryGenerator'
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
 * Ensure an entry's AI fields (summary + insights + prompts) and its summary
 * vector are up to date.
 *
 * This is the single source of truth for per-entry AI generation/indexing,
 * shared by every content-indexing path (`/v1/rag/index` and
 * `/v1/ai/transcribe`). All three sections are produced in ONE LLM call
 * (`generateEntryAI`) and written together, so they never drift apart and the
 * client tabs are read-only displays of what is stored here. Voice and video
 * entries reach the server only through transcription, so without a shared
 * helper here those entries would never get a summary vector — which silently
 * breaks the constellation graph and the "Related" tab (both read the
 * `journal_summaries` collection).
 *
 * All text is field-encrypted with the same AAD contexts the iOS client uses
 * (`journals.summary.text`, `journals.insights.text`, `journals.prompts.items.N`)
 * so it round-trips. The Firestore write happens BEFORE indexing the vector, so
 * the stored text is valid even if embedding fails. Throws on failure; callers
 * decide whether an AI failure should fail their request (content/transcript is
 * kept either way).
 *
 * @returns whether the entry now has an indexed summary vector.
 */
export async function ensureEntryAIIndexed(params: {
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
  const ai = await generateEntryAI({ type, content, userConfig })
  const generatedAt = admin.firestore.Timestamp.fromDate(new Date(ai.generatedAt))

  // Summary + insights + prompts written together (one update) so the tabs
  // never show a partial set. Contexts match iOS FirestoreMapping exactly.
  await db.collection('journals').doc(journalId).update({
    summary: {
      text: encryptField(dek, ai.summary, 'journals.summary.text'),
      generatedAt,
      model: ai.model,
    },
    insights: {
      text: encryptField(dek, ai.insights, 'journals.insights.text'),
      generatedAt,
      model: ai.model,
    },
    prompts: {
      items: ai.prompts.map((p, i) => encryptField(dek, p, `journals.prompts.items.${i}`)),
      generatedAt,
      model: ai.model,
    },
  })

  await indexSummary({ userId: uid, entryId: journalId, summaryText: ai.summary, type, title, date, dek })
  return true
}
