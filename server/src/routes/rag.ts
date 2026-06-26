import { Router, Request, Response } from 'express'
import admin from 'firebase-admin'
import { firebaseAuth, db } from '../middleware/firebaseAuth'
import { config } from '../config'
import { indexJournalEntry, deleteJournalEntry } from '../services/journalIndexer'
import { deleteSummary, findRelated } from '../services/summaryIndexer'
import { ensureEntrySummaryIndexed } from '../services/summaryService'
import { getOrCreateDEK } from '../crypto/keyService'
import { openField, decryptField } from '../crypto/fieldCipher'
import { deleteMediaObjects } from '../services/s3'
import { getJournalsCollection, getSummariesCollection } from '../db/chroma'
import { embedQuery } from '../services/aiClient'
import { getGraph, invalidateGraph } from '../services/graphBuilder'

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

  // 2) Summary: regenerate when missing, stale, or forced. Shared with the
  //    transcribe path via ensureEntrySummaryIndexed so every content path
  //    keeps the summary vector in sync (see services/summaryService.ts).
  let summaryIndexed = false
  try {
    summaryIndexed = await ensureEntrySummaryIndexed({
      uid, journalId, data, content, title, type, date: updatedAt.slice(0, 10), dek, force,
    })
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

  // The user's similarity graph may have changed — drop the cache so the next
  // /graph call rebuilds (cheap; pure vector math).
  invalidateGraph(uid)

  res.json({ indexed: true, chunks: chunkCount, summaryIndexed })
})

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
    invalidateGraph(uid)
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

export async function graphHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string
  try {
    const dek = await getOrCreateDEK(uid)
    const graph = await getGraph({
      userId: uid,
      dek,
      topK: config.GRAPH_TOP_K,
      minSimilarity: config.GRAPH_MIN_SIMILARITY,
      maxDegree: config.GRAPH_MAX_DEGREE,
    })
    res.json(graph)
  } catch (err) {
    console.error('[rag/graph]', err)
    res.status(500).json({ error: 'Graph build failed' })
  }
}

ragRouter.post('/graph', firebaseAuth, graphHandler)

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

interface SearchResult {
  journalId: string
  title: string
  type: string
  date: string
  snippet: string
  score: number
}

const SEARCH_MAX_CHARS = 500
const SNIPPET_RADIUS = 100

function normalise(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function extractSnippet(content: string, query: string): string {
  const normContent = normalise(content)
  const normQuery = normalise(query)
  const idx = normContent.indexOf(normQuery)
  if (idx === -1) {
    // Match was in title — use leading content as snippet
    const raw = content.slice(0, SNIPPET_RADIUS * 2)
    return raw.length < content.length ? raw + '…' : raw
  }
  const start = Math.max(0, idx - SNIPPET_RADIUS)
  const end = Math.min(content.length, idx + normQuery.length + SNIPPET_RADIUS)
  const snippet = content.slice(start, end)
  return (start > 0 ? '…' : '') + snippet + (end < content.length ? '…' : '')
}

ragRouter.post('/search/keyword', firebaseAuth, async (req: Request, res: Response) => {
  const uid = (req as any).uid as string
  const { query } = req.body as { query?: string }

  if (!query || !query.trim()) {
    res.status(400).json({ error: 'Missing query' })
    return
  }
  if (query.length > SEARCH_MAX_CHARS) {
    res.status(400).json({ error: 'Query too long' })
    return
  }

  try {
    const dek = await getOrCreateDEK(uid)
    const snap = await db.collection('journals')
      .where('userId', '==', uid)
      .select('title', 'content', 'type', 'updatedAt')
      .get()

    const normQuery = normalise(query)
    const results: SearchResult[] = []

    for (const doc of snap.docs) {
      const data = doc.data()
      const title = openField(dek, data.title, 'journals.title')
      const content = openField(dek, data.content, 'journals.content')

      if (!normalise(title).includes(normQuery) && !normalise(content).includes(normQuery)) {
        continue
      }

      const updatedAt = (data.updatedAt as admin.firestore.Timestamp)?.toDate()
      results.push({
        journalId: doc.id,
        title,
        type: data.type ?? 'text',
        date: updatedAt ? updatedAt.toISOString().slice(0, 10) : '',
        snippet: extractSnippet(content, query),
        score: 0,
      })
    }

    // Newest first, cap at 100
    results.sort((a, b) => b.date.localeCompare(a.date))
    res.json({ results: results.slice(0, 100) })
  } catch (err) {
    console.error('[rag/search/keyword]', err)
    res.status(500).json({ error: 'Keyword search failed' })
  }
})

ragRouter.post('/search/semantic', firebaseAuth, async (req: Request, res: Response) => {
  const uid = (req as any).uid as string
  const { query } = req.body as { query?: string }

  if (!query || !query.trim()) {
    res.status(400).json({ error: 'Missing query' })
    return
  }
  if (query.length > SEARCH_MAX_CHARS) {
    res.status(400).json({ error: 'Query too long' })
    return
  }

  try {
    const [dek, queryVec] = await Promise.all([getOrCreateDEK(uid), embedQuery(query)])

    const queryOpts = {
      queryEmbeddings: [queryVec],
      nResults: 15,
      where: { userId: { $eq: uid } },
      include: ['documents', 'metadatas', 'distances'] as any,
    }

    const [chunksCol, summariesCol] = await Promise.all([
      getJournalsCollection(),
      getSummariesCollection(),
    ])

    const [chunkRes, summaryRes] = await Promise.all([
      chunksCol.query(queryOpts),
      summariesCol.query(queryOpts),
    ])

    const merged = new Map<string, SearchResult>()

    const processResults = (
      docs: (string | null)[][],
      metas: (Record<string, unknown> | null)[][],
      dists: number[][],
      getSnippetContext: (meta: Record<string, unknown>) => string,
    ) => {
      const docList = docs[0] ?? []
      const metaList = metas[0] ?? []
      const distList = dists[0] ?? []
      for (let i = 0; i < docList.length; i++) {
        const m = (metaList[i] ?? {}) as Record<string, unknown>
        const journalId = (m.entryId as string) ?? ''
        if (!journalId) continue
        const score = typeof distList[i] === 'number' ? Math.max(0, 1 - distList[i]) : 0
        const existing = merged.get(journalId)
        if (existing && existing.score >= score) continue
        const title = m.title ? decryptField(dek, JSON.parse(m.title as string), 'journals.title') : ''
        const snippet = docList[i]
          ? decryptField(dek, JSON.parse(docList[i] as string), getSnippetContext(m))
          : ''
        merged.set(journalId, {
          journalId,
          title,
          type: (m.type as string) ?? 'text',
          date: (m.date as string) ?? (m.indexedAt as string | undefined)?.slice(0, 10) ?? '',
          snippet,
          score,
        })
      }
    }

    processResults(
      chunkRes.documents as any,
      chunkRes.metadatas as any,
      (chunkRes as any).distances ?? [],
      (m) => `rag.chunk.${typeof m.chunkIndex === 'number' ? m.chunkIndex : 0}`,
    )
    processResults(
      summaryRes.documents as any,
      summaryRes.metadatas as any,
      (summaryRes as any).distances ?? [],
      () => 'rag.summary',
    )

    const results = Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)

    res.json({ results })
  } catch (err) {
    console.error('[rag/search/semantic]', err)
    res.status(500).json({ error: 'Semantic search failed' })
  }
})
