import { Router, Request, Response } from 'express'
import { firebaseAuth } from '../middleware/firebaseAuth'
import { requireAiConsent } from '../middleware/requireAiConsent'
import { indexEntryChunks, deleteEntryChunks, searchChunks, getEntryDayIndex } from '../services/ragStore'
import { updateConstellationForDay } from '../services/constellation/constellationService'
import { computeJournalGraph } from '../services/ragGraph'

/**
 * Recompute the user's Soul Constellation for one day, off the request's critical
 * path. Server-side, zero-knowledge: derives the day's centroid from the stored
 * chunk vectors (no text) and re-projects the star field. Non-fatal — a failure is
 * logged and never fails the index/delete that triggered it.
 */
async function refreshConstellationForDay(userId: string, dayIndex: number): Promise<void> {
  try {
    await updateConstellationForDay(userId, dayIndex)
  } catch (e) {
    console.error('[rag] constellation refresh failed', { dayIndex }, e)
  }
}

// Chunk-level semantic RAG. The vector store holds NO journal text — only vectors
// + metadata. Chunking happens on the CLIENT (deterministic); this router just
// embeds (via the active provider) and stores/searches. Ownership is the token uid.
export const ragRouter = Router()
ragRouter.use(firebaseAuth)

const DEFAULT_TOP_K = 8
const MAX_TOP_K = 50

// PUT /v1/rag/index — re-index one entry's client-supplied chunks.
export async function indexHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string
  const body = req.body as {
    entryId?: unknown; type?: unknown; dayIndex?: unknown; wordCount?: unknown; chunks?: unknown
  }
  if (typeof body.entryId !== 'string' || body.entryId.length === 0) {
    res.status(400).json({ error: 'Missing entryId' }); return
  }
  if (!Array.isArray(body.chunks) || body.chunks.some(c => typeof c !== 'string')) {
    res.status(400).json({ error: 'chunks must be a string array' }); return
  }
  const dayIndex = typeof body.dayIndex === 'number' ? body.dayIndex : 0
  try {
    const n = await indexEntryChunks({
      userId: uid, // ownership from the token — NEVER the body
      entryId: body.entryId,
      type: typeof body.type === 'string' ? body.type : 'text',
      dayIndex,
      wordCount: typeof body.wordCount === 'number' ? body.wordCount : 0,
      chunks: body.chunks as string[],
    })
    // Keep the day's constellation star in sync with the just-indexed chunks.
    await refreshConstellationForDay(uid, dayIndex)
    res.json({ ok: true, entryId: body.entryId, chunks: n })
  } catch (e) {
    console.error('[rag/index]', e)
    res.status(500).json({ error: 'Index failed' })
  }
}

// DELETE /v1/rag/:entryId — purge an entry's chunks.
export async function deleteHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string
  const entryId = req.params.entryId
  if (!entryId) { res.status(400).json({ error: 'Missing entryId' }); return }
  try {
    // Capture the entry's day BEFORE purging its chunks so we can recompute that
    // day's star (it may lose its ≥750-word qualification once the entry is gone).
    const dayIndex = await getEntryDayIndex(uid, entryId)
    await deleteEntryChunks(uid, entryId)
    if (dayIndex !== null) await refreshConstellationForDay(uid, dayIndex)
    res.json({ deleted: true, entryId })
  } catch (e) {
    console.error('[rag/delete]', e)
    res.status(500).json({ error: 'Delete failed' })
  }
}

// POST /v1/rag/search — return chunk references (entryId + chunkIndex + score).
export async function searchHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string
  const body = req.body as { queryText?: unknown; topK?: unknown }
  if (typeof body.queryText !== 'string' || body.queryText.trim().length === 0) {
    res.status(400).json({ error: 'Missing queryText' }); return
  }
  const topK = Math.min(
    MAX_TOP_K,
    Math.max(1, typeof body.topK === 'number' ? Math.floor(body.topK) : DEFAULT_TOP_K),
  )
  try {
    const hits = await searchChunks(uid, body.queryText, topK)
    res.json({ hits })
  } catch (e) {
    console.error('[rag/search]', e)
    // Fail-soft: retrieval errors return no hits so chat/AI continues without context.
    res.json({ hits: [] })
  }
}

// POST /v1/rag/graph — journal similarity graph (entry ids + edges, no text).
export async function graphHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string
  try {
    const graph = await computeJournalGraph(uid)
    res.json(graph)
  } catch (e) {
    console.error('[rag/graph]', e)
    // Fail-soft: an empty graph renders as "not enough entries yet".
    res.json({ nodes: [], edges: [] })
  }
}

ragRouter.put('/index', requireAiConsent, indexHandler)
ragRouter.post('/search', requireAiConsent, searchHandler)
ragRouter.post('/graph', requireAiConsent, graphHandler)
ragRouter.delete('/:entryId', deleteHandler)
