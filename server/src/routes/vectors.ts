import { Router, Request, Response } from 'express'
import admin from 'firebase-admin'
import { firebaseAuth, db } from '../middleware/firebaseAuth'

// ---------------------------------------------------------------------------
// Encrypted vector blob store (increment 1c-D, Phase 2 — server part).
//
// ZERO-KNOWLEDGE: this router is a DUMB ciphertext blob store. The iOS client
// computes 768-dim embeddings on-device, wraps each vector with the user's DEK
// (client-side), and syncs the resulting opaque ciphertext blob here. The server
// stores/returns those blobs VERBATIM — it does NO similarity math, NEVER parses
// or decrypts a blob, and NEVER sees a plaintext vector or a decryption key.
//
// Storage: a top-level `vectors` collection. Each doc carries an explicit
// `userId` field and its id is `${uid}__${entryId}`, so (a) every read/write is
// userId-scoped (ownership comes from the auth token, NEVER the request body),
// and (b) upserts + deletes for a given (uid, entryId) are naturally idempotent.
// ---------------------------------------------------------------------------

export const vectorsRouter = Router()
vectorsRouter.use(firebaseAuth)

const COLLECTION = 'vectors'

/** Owner-scoped doc id. Embedding the uid means a caller can only ever address
 *  their own blob for an entry — cross-tenant addressing is impossible. */
function vectorDocId(uid: string, entryId: string): string {
  return `${uid}__${entryId}`
}

/** Normalise a stored `updatedAt` (Firestore Timestamp in prod, string/null in
 *  tests) to an ISO string or null. */
function isoUpdatedAt(ua: unknown): string | null {
  if (ua && typeof (ua as any).toDate === 'function') {
    return (ua as any).toDate().toISOString()
  }
  return typeof ua === 'string' ? ua : null
}

interface StoredVector {
  userId: string
  entryId: string
  blob: string
  dim: number
  model: string
  updatedAt: unknown
}

interface VectorItem {
  entryId: string
  blob: string
  dim: number
  model: string
  updatedAt: string | null
}

function toItem(data: Record<string, unknown>): VectorItem {
  return {
    entryId: String(data.entryId ?? ''),
    blob: String(data.blob ?? ''),
    dim: typeof data.dim === 'number' ? data.dim : Number(data.dim ?? 0),
    model: typeof data.model === 'string' ? data.model : '',
    updatedAt: isoUpdatedAt(data.updatedAt),
  }
}

/** Validate one blob payload. Returns an error message or null if valid. The
 *  blob is treated as OPAQUE — we only check it is a non-empty string. We never
 *  parse or interpret its contents. */
function validateBlobPayload(body: {
  blob?: unknown
  dim?: unknown
  model?: unknown
}): string | null {
  if (typeof body.blob !== 'string' || body.blob.length === 0) {
    return 'Missing or invalid blob'
  }
  if (typeof body.dim !== 'number' || !Number.isFinite(body.dim) || body.dim <= 0) {
    return 'Missing or invalid dim'
  }
  if (body.model !== undefined && typeof body.model !== 'string') {
    return 'Invalid model'
  }
  return null
}

function buildStored(uid: string, entryId: string, body: {
  blob: string
  dim: number
  model?: unknown
}): StoredVector {
  return {
    userId: uid, // ownership from the token — NEVER from the request body
    entryId,
    blob: body.blob, // stored VERBATIM — never parsed or decrypted
    dim: body.dim,
    model: typeof body.model === 'string' ? body.model : '',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }
}

// PUT /v1/vectors/:entryId — upsert one encrypted blob for (uid, entryId).
export async function putVectorHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string
  const entryId = req.params.entryId
  if (!entryId) {
    res.status(400).json({ error: 'Missing entryId' })
    return
  }
  const body = req.body as { blob?: unknown; dim?: unknown; model?: unknown }
  const err = validateBlobPayload(body)
  if (err) {
    res.status(400).json({ error: err })
    return
  }
  try {
    await db
      .collection(COLLECTION)
      .doc(vectorDocId(uid, entryId))
      .set(buildStored(uid, entryId, body as { blob: string; dim: number; model?: unknown }))
    res.json({ ok: true, entryId })
  } catch (e) {
    console.error('[vectors/put]', e)
    res.status(500).json({ error: 'Store failed' })
  }
}

// GET /v1/vectors — list ALL of the caller's blobs (userId-scoped query ONLY).
export async function listVectorsHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string
  try {
    const snap = await db.collection(COLLECTION).where('userId', '==', uid).get()
    const vectors = snap.docs.map(d => toItem(d.data() as Record<string, unknown>))
    res.json({ vectors })
  } catch (e) {
    console.error('[vectors/list]', e)
    res.status(500).json({ error: 'List failed' })
  }
}

// DELETE /v1/vectors/:entryId — delete the caller's blob for that entry.
export async function deleteVectorHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string
  const entryId = req.params.entryId
  if (!entryId) {
    res.status(400).json({ error: 'Missing entryId' })
    return
  }
  try {
    // The doc id embeds the uid, so this only ever targets the caller's own doc.
    await db.collection(COLLECTION).doc(vectorDocId(uid, entryId)).delete()
    res.json({ deleted: true, entryId })
  } catch (e) {
    console.error('[vectors/delete]', e)
    res.status(500).json({ error: 'Delete failed' })
  }
}

// POST /v1/vectors/batch — upsert many blobs at once (backfill). Same ownership
// rules: uid from the token, one owner-scoped doc per item.
export async function batchVectorsHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string
  const body = req.body as { vectors?: unknown }
  const items = body.vectors
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Missing or empty vectors array' })
    return
  }
  // Validate every item before writing anything.
  for (const raw of items) {
    const item = raw as { entryId?: unknown; blob?: unknown; dim?: unknown; model?: unknown }
    if (typeof item.entryId !== 'string' || item.entryId.length === 0) {
      res.status(400).json({ error: 'Each item needs an entryId' })
      return
    }
    const err = validateBlobPayload(item)
    if (err) {
      res.status(400).json({ error: `${err} for entry ${item.entryId}` })
      return
    }
  }
  try {
    const batch = db.batch()
    for (const raw of items) {
      const item = raw as { entryId: string; blob: string; dim: number; model?: unknown }
      const ref = db.collection(COLLECTION).doc(vectorDocId(uid, item.entryId))
      batch.set(ref, buildStored(uid, item.entryId, item))
    }
    await batch.commit()
    res.json({ ok: true, count: items.length })
  } catch (e) {
    console.error('[vectors/batch]', e)
    res.status(500).json({ error: 'Batch store failed' })
  }
}

vectorsRouter.get('/', listVectorsHandler)
vectorsRouter.post('/batch', batchVectorsHandler)
vectorsRouter.put('/:entryId', putVectorHandler)
vectorsRouter.delete('/:entryId', deleteVectorHandler)
