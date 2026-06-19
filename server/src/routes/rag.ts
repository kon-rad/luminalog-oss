import { Router, Request, Response } from 'express'
import admin from 'firebase-admin'
import { firebaseAuth, db } from '../middleware/firebaseAuth'
import { config } from '../config'
import { indexJournalEntry, deleteJournalEntry } from '../services/journalIndexer'
import { indexSummary, deleteSummary, findRelated } from '../services/summaryIndexer'
import { generateSummaryText } from '../services/summaryGenerator'
import { getOrCreateDEK } from '../crypto/keyService'
import { openField, encryptField } from '../crypto/fieldCipher'
import { deleteMediaObjects } from '../services/s3'

export const ragRouter = Router()

ragRouter.post('/index', firebaseAuth, async (req: Request, res: Response) => {
  const uid = (req as any).uid as string
  const { journalId, force } = req.body as { journalId?: string; force?: boolean }

  if (!journalId) {
    res.status(400).json({ error: 'Missing journalId' })
    return
  }

  const docSnap = await db.collection('journals').doc(journalId).get()
  if (!docSnap.exists) {
    res.status(404).json({ error: 'Journal not found' })
    return
  }
  const data = docSnap.data()!
  if (data.userId !== uid) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const dek = await getOrCreateDEK(uid)
  const content = openField(dek, data.content, 'journals.content')
  if (!content.trim()) {
    res.json({ indexed: false, chunks: 0, reason: 'empty_content' })
    return
  }

  const title = openField(dek, data.title, 'journals.title')
  const type = data.type ?? 'text'
  const updatedAt = (data.updatedAt as admin.firestore.Timestamp)?.toDate().toISOString()
    ?? new Date().toISOString()

  // 1) Content chunks (chat RAG) — must not be lost on summary failure.
  let chunkCount = 0
  try {
    const result = await indexJournalEntry({ userId: uid, entryId: journalId, content, title, type, updatedAt, dek })
    chunkCount = result.chunks
  } catch (err) {
    console.error('[rag/index] content index failed', err)
    await db.collection('journals').doc(journalId).update({ 'vector.status': 'failed' }).catch(() => {})
    res.status(500).json({ error: 'Indexing failed' })
    return
  }

  // 2) Summary: regenerate when missing, stale, or forced.
  let summaryIndexed = false
  try {
    if (shouldRegenerateSummary(data, force)) {
      const userConfig = (await db.collection('users').doc(uid).get()).data()?.summaryConfig
      const summary = await generateSummaryText({ type, content, userConfig })

      await db.collection('journals').doc(journalId).update({
        summary: {
          text: encryptField(dek, summary.text, 'journals.summary.text'),
          generatedAt: admin.firestore.Timestamp.fromDate(new Date(summary.generatedAt)),
          model: summary.model,
        },
      })

      await indexSummary({
        userId: uid, entryId: journalId, summaryText: summary.text,
        type, title, date: updatedAt.slice(0, 10), dek,
      })
      summaryIndexed = true
    } else {
      summaryIndexed = data.vector?.summaryIndexed === true
    }
  } catch (err) {
    console.error('[rag/index] summary step failed (content index kept)', err)
  }

  await db.collection('journals').doc(journalId).update({
    vector: {
      status: 'indexed',
      chunkCount,
      summaryIndexed,
      indexedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  })

  res.json({ indexed: true, chunks: chunkCount, summaryIndexed })
})

/** Regenerate when forced, when there is no summary, or when content was edited
 *  after the summary was generated (stale). */
function shouldRegenerateSummary(
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

export async function deleteHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string
  const journalId = req.query['journalId'] as string | undefined

  if (!journalId) {
    res.status(400).json({ error: 'Missing journalId query param' })
    return
  }

  // Best-effort S3 media purge. Read the doc for the media keys and verify
  // ownership; a missing doc just means there are no keys to collect.
  try {
    const snap = await db.collection('journals').doc(journalId).get()
    if (snap.exists) {
      const data = snap.data()!
      if (data.userId !== uid) {
        res.status(403).json({ error: 'Forbidden' })
        return
      }
      const prefix = `users/${uid}/`
      const keys: string[] = []
      for (const m of (data.media ?? []) as Array<Record<string, unknown>>) {
        const k = m['s3Key']
        const t = m['thumbnailS3Key']
        if (typeof k === 'string' && k.startsWith(prefix)) keys.push(k)
        if (typeof t === 'string' && t.startsWith(prefix)) keys.push(t)
      }
      await deleteMediaObjects(keys)
    }
  } catch (err) {
    // Best-effort: log and continue to embedding purge (spec delete policy).
    console.error('[rag/delete] media purge failed (continuing)', err)
  }

  try {
    await deleteJournalEntry(uid, journalId)
    await deleteSummary(uid, journalId)
    res.json({ deleted: true })
  } catch (err) {
    console.error('[rag/delete]', err)
    res.status(500).json({ error: 'Delete failed' })
  }
}

ragRouter.delete('/delete', firebaseAuth, deleteHandler)

export async function relatedHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string
  const { journalId, limit } = req.body as { journalId?: string; limit?: number }
  if (!journalId) { res.status(400).json({ error: 'Missing journalId' }); return }

  try {
    const snap = await db.collection('journals').doc(journalId).get()
    if (!snap.exists) { res.status(404).json({ error: 'Journal not found' }); return }
    if (snap.data()!.userId !== uid) { res.status(403).json({ error: 'Forbidden' }); return }

    const dek = await getOrCreateDEK(uid)
    const related = await findRelated({
      userId: uid,
      entryId: journalId,
      limit: Math.min(limit ?? config.RELATED_TOP_K, config.RELATED_TOP_K),
      dek,
    })
    res.json({ related })
  } catch (err: any) {
    console.error('[rag/related]', err)
    res.status(500).json({ error: 'Related lookup failed' })
  }
}

ragRouter.post('/related', firebaseAuth, relatedHandler)
