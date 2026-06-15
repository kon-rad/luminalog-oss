import { Router, Request, Response } from 'express'
import admin from 'firebase-admin'
import { firebaseAuth, db } from '../middleware/firebaseAuth'
import { indexJournalEntry, deleteJournalEntry } from '../services/journalIndexer'
import { getOrCreateDEK } from '../crypto/keyService'
import { openField } from '../crypto/fieldCipher'

export const ragRouter = Router()

ragRouter.post('/index', firebaseAuth, async (req: Request, res: Response) => {
  const uid = (req as any).uid as string
  const { journalId } = req.body as { journalId?: string }

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

  try {
    const result = await indexJournalEntry({
      userId: uid,
      entryId: journalId,
      content,
      title: openField(dek, data.title, 'journals.title'),
      type: data.type ?? 'text',
      updatedAt: (data.updatedAt as admin.firestore.Timestamp)?.toDate().toISOString()
        ?? new Date().toISOString(),
      dek,
    })

    await db.collection('journals').doc(journalId).update({
      vector: {
        status: 'indexed',
        chunkCount: result.chunks,
        indexedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    })

    res.json({ indexed: true, chunks: result.chunks })
  } catch (err) {
    console.error('[rag/index]', err)

    await db.collection('journals').doc(journalId).update({
      'vector.status': 'failed',
    }).catch(() => {})

    res.status(500).json({ error: 'Indexing failed' })
  }
})

ragRouter.delete('/delete', firebaseAuth, async (req: Request, res: Response) => {
  const uid = (req as any).uid as string
  const journalId = req.query['journalId'] as string | undefined

  if (!journalId) {
    res.status(400).json({ error: 'Missing journalId query param' })
    return
  }

  try {
    await deleteJournalEntry(uid, journalId)
    res.json({ deleted: true })
  } catch (err) {
    console.error('[rag/delete]', err)
    res.status(500).json({ error: 'Delete failed' })
  }
})
