import { Router, Request, Response } from 'express'
import admin from 'firebase-admin'
import { firebaseAuth, db } from '../middleware/firebaseAuth'

// ---------------------------------------------------------------------------
// AI-data-sharing consent (increment 1b — ADDITIVE).
//
// Records the user's explicit consent to AI data sharing so the (flag-gated)
// `requireAiConsent` guard can enforce it as defense-in-depth. Every read/write
// is scoped to the auth-token uid — never the request body.
//
// Storage: `users/{uid}.consent = { aiDataSharing, version, acceptedAt }`.
// ---------------------------------------------------------------------------

export const consentRouter = Router()
consentRouter.use(firebaseAuth)

interface ConsentRecord {
  aiDataSharing: boolean
  version: string
  acceptedAt: string | null
}

/** Normalise a stored `acceptedAt` (Firestore Timestamp in prod, string/null in
 *  tests) to an ISO string or null. */
function isoAcceptedAt(ts: unknown): string | null {
  if (ts && typeof (ts as any).toDate === 'function') {
    return (ts as any).toDate().toISOString()
  }
  return typeof ts === 'string' ? ts : null
}

// PUT /v1/consent — record consent. Body carries `version` (string) plus at least one
// of the boolean consent flags: `aiDataSharing` and/or `soulPublicNft` (the public,
// on-chain Soul NFT that publishes the user's first name + stats — gates minting).
export async function putConsentHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string
  const body = req.body as { aiDataSharing?: unknown; soulPublicNft?: unknown; version?: unknown }

  const hasAi = typeof body?.aiDataSharing === 'boolean'
  const hasSoul = typeof body?.soulPublicNft === 'boolean'
  if (!hasAi && !hasSoul) {
    res.status(400).json({ error: 'Provide aiDataSharing and/or soulPublicNft (boolean)' })
    return
  }
  if (typeof body.version !== 'string' || body.version.length === 0) {
    res.status(400).json({ error: 'Missing or invalid version (string)' })
    return
  }
  // Merge only the flags that were provided, so recording one doesn't clobber the other.
  const consent: Record<string, unknown> = {
    version: body.version,
    acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
  }
  if (hasAi) consent.aiDataSharing = body.aiDataSharing
  if (hasSoul) consent.soulPublicNft = body.soulPublicNft

  try {
    await db
      .collection('users')
      .doc(uid) // ownership from the token — NEVER from the request body
      .set({ consent }, { merge: true })
    res.json({ ok: true, aiDataSharing: body.aiDataSharing, soulPublicNft: body.soulPublicNft, version: body.version })
  } catch (e) {
    console.error('[consent/put]', e)
    res.status(500).json({ error: 'Store failed' })
  }
}

// GET /v1/consent — return the caller's consent record, or null if none.
export async function getConsentHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string
  try {
    const snap = await db.collection('users').doc(uid).get()
    const raw = snap.exists ? (snap.get('consent') as Record<string, unknown> | undefined) : undefined
    if (!raw) {
      res.json({ consent: null })
      return
    }
    const consent: ConsentRecord = {
      aiDataSharing: raw.aiDataSharing === true,
      version: typeof raw.version === 'string' ? raw.version : '',
      acceptedAt: isoAcceptedAt(raw.acceptedAt),
    }
    res.json({ consent })
  } catch (e) {
    console.error('[consent/get]', e)
    res.status(500).json({ error: 'Fetch failed' })
  }
}

consentRouter.put('/', putConsentHandler)
consentRouter.get('/', getConsentHandler)
