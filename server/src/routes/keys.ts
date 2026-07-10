import { Router, Request, Response } from 'express'
import admin from 'firebase-admin'
import { firebaseAuth, db } from '../middleware/firebaseAuth'
import { getOrCreateDEK, cryptoShredUser, MigratedNoServerDEKError } from '../crypto/keyService'

export const keysRouter = Router()

// ---------------------------------------------------------------------------
// LEGACY (non-ZK) key path — UNCHANGED. The server generates the DEK, wraps it
// under `config.MASTER_KEY`, and hands the raw DEK to the client here. This is
// the current, live behavior and stays alive during the ZK transition; it is
// removed only at the gated 1d cutover — do NOT disable it in 1b.
// ---------------------------------------------------------------------------
keysRouter.post('/bootstrap', firebaseAuth, async (req: Request, res: Response) => {
  const uid = (req as any).uid as string
  try {
    const dek = await getOrCreateDEK(uid)
    res.json({ dek: dek.toString('base64') })
  } catch (err) {
    // A migrated user has no server DEK; tell the client to use the iCloud-key path
    // (never regenerate a DEK). 409 — this is what keeps the 1d finalize safe.
    if (err instanceof MigratedNoServerDEKError) {
      res.status(409).json({ error: 'Migrated: use client-held keys' })
      return
    }
    console.error('[keys/bootstrap]', err)
    res.status(500).json({ error: 'Key bootstrap failed' })
  }
})

// ---------------------------------------------------------------------------
// ZERO-KNOWLEDGE wrapped-key storage (increment 1b — ADDITIVE).
//
// The DEK is wrapped CLIENT-SIDE under client-held KEKs (a random key in the
// iCloud Keychain and an HKDF(recovery-code) key). The server stores only the
// resulting OPAQUE `{v,iv,ct,tag}` ciphertext envelopes — it holds none of the
// KEKs and can NEVER unwrap them. It NEVER accepts or returns a raw DEK here.
//
// Storage: `users/{uid}.wrappedKeys` is a map of method → envelope, plus a
// `zkKeyVersion`. Ownership is ALWAYS the auth-token uid — never the body.
// This does NOT touch keyService.ts / MASTER_KEY / `/bootstrap` above.
// ---------------------------------------------------------------------------

/** Methods (KEK slots) a wrap may be stored under. */
const WRAP_METHODS = ['icloud', 'recovery'] as const
type WrapMethod = (typeof WRAP_METHODS)[number]

interface Envelope { v: number; iv: string; ct: string; tag: string }

/**
 * Validate a single wrap envelope shape. Returns true ONLY for a strict
 * `{v:number, iv:string, ct:string, tag:string}` object — i.e. an opaque
 * AES-GCM ciphertext blob. This is what fails-closed against a raw key: a raw
 * key (a bare base64 string, or `{key|dek|secret:...}`) has no iv/ct/tag and is
 * rejected, so the server can never be tricked into storing plaintext key
 * material.
 */
export function isEnvelope(x: unknown): x is Envelope {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false
  const e = x as Record<string, unknown>
  if (typeof e.v !== 'number' || !Number.isFinite(e.v)) return false
  if (typeof e.iv !== 'string' || e.iv.length === 0) return false
  if (typeof e.ct !== 'string' || e.ct.length === 0) return false
  if (typeof e.tag !== 'string' || e.tag.length === 0) return false
  return true
}

// PUT /v1/keys/wrapped — store the DEK-wrapped-under-client-KEK envelopes.
// Body: { wraps: { icloud?: {v,iv,ct,tag}, recovery?: {v,iv,ct,tag} }, keyVersion?: number }
export async function putWrappedKeysHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string
  const body = req.body as { wraps?: unknown; keyVersion?: unknown }
  const wraps = body?.wraps

  if (typeof wraps !== 'object' || wraps === null || Array.isArray(wraps)) {
    res.status(400).json({ error: 'Missing or invalid wraps map' })
    return
  }

  // Only known methods are accepted; every provided value MUST be a valid
  // opaque envelope (never a raw key). At least one wrap is required.
  const clean: Record<string, Envelope> = {}
  for (const [method, value] of Object.entries(wraps as Record<string, unknown>)) {
    if (!WRAP_METHODS.includes(method as WrapMethod)) {
      res.status(400).json({ error: `Unknown wrap method '${method}'` })
      return
    }
    if (!isEnvelope(value)) {
      res.status(400).json({ error: `Invalid envelope for '${method}' (expected {v,iv,ct,tag}, not a raw key)` })
      return
    }
    // Copy only the envelope fields — never persist stray/extra keys from the body.
    clean[method] = { v: value.v, iv: value.iv, ct: value.ct, tag: value.tag }
  }
  if (Object.keys(clean).length === 0) {
    res.status(400).json({ error: 'wraps must contain at least one envelope' })
    return
  }

  const keyVersion =
    typeof body.keyVersion === 'number' && Number.isFinite(body.keyVersion)
      ? body.keyVersion
      : 1

  try {
    // Merge so a caller can add/replace one slot without clobbering the other.
    await db
      .collection('users')
      .doc(uid) // ownership from the token — NEVER from the request body
      .set({ wrappedKeys: clean, zkKeyVersion: keyVersion }, { merge: true })
    res.json({ ok: true, methods: Object.keys(clean), zkKeyVersion: keyVersion })
  } catch (e) {
    console.error('[keys/wrapped/put]', e)
    res.status(500).json({ error: 'Store failed' })
  }
}

// GET /v1/keys/wrapped — return the caller's opaque wrap envelopes (or {}).
export async function getWrappedKeysHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string
  try {
    const snap = await db.collection('users').doc(uid).get()
    const wrappedKeys = (snap.exists ? snap.get('wrappedKeys') : undefined) ?? {}
    const zkKeyVersion = snap.exists ? snap.get('zkKeyVersion') : undefined
    res.json({ wrappedKeys, zkKeyVersion: zkKeyVersion ?? null })
  } catch (e) {
    console.error('[keys/wrapped/get]', e)
    res.status(500).json({ error: 'Fetch failed' })
  }
}

// DELETE /v1/keys/wrapped/:method — remove one wrap slot for the caller.
export async function deleteWrappedKeyHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string
  const method = req.params.method
  if (!WRAP_METHODS.includes(method as WrapMethod)) {
    res.status(400).json({ error: `Unknown wrap method '${method}'` })
    return
  }
  try {
    await db
      .collection('users')
      .doc(uid)
      .set(
        { wrappedKeys: { [method]: admin.firestore.FieldValue.delete() } },
        { merge: true },
      )
    res.json({ deleted: true, method })
  } catch (e) {
    console.error('[keys/wrapped/delete]', e)
    res.status(500).json({ error: 'Delete failed' })
  }
}

keysRouter.put('/wrapped', firebaseAuth, putWrappedKeysHandler)
keysRouter.get('/wrapped', firebaseAuth, getWrappedKeysHandler)
keysRouter.delete('/wrapped/:method', firebaseAuth, deleteWrappedKeyHandler)

// ---------------------------------------------------------------------------
// GUARDED, IRREVERSIBLE finalize step (increment 1d).
//
// Deletes the legacy server-held `wrappedDEK` (crypto-shredding it via
// `cryptoShredUser`) — but ONLY once the caller has already uploaded BOTH
// client-held wraps (`wrappedKeys.icloud` and `.recovery`). After this call
// the server holds no key material capable of recovering the DEK on its own;
// recovery is possible ONLY from a client-held KEK (iCloud Keychain) or the
// user's recovery code. This is why the guard is strict and fails closed
// (409) rather than ever deleting `wrappedDEK` speculatively.
//
// Idempotent: if `wrappedDEK` is already gone but `wrappedKeys` is present,
// this still returns 200 `{finalized:true}` (cryptoShredUser deleting an
// already-absent field is a no-op). Ownership is ALWAYS the auth-token uid
// — never the request body.
// ---------------------------------------------------------------------------
export async function finalizeMigrationHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string
  try {
    const snap = await db.collection('users').doc(uid).get()
    const wk = snap.exists ? snap.get('wrappedKeys') : undefined
    if (!(isEnvelope(wk?.icloud) && isEnvelope(wk?.recovery))) {
      res.status(409).json({ error: 'Not migrated: client wraps not present' })
      return
    }
    await cryptoShredUser(uid)
    await db
      .collection('users')
      .doc(uid)
      .set({ zkMigratedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
    res.json({ finalized: true })
  } catch (e) {
    console.error('[keys/finalize-migration]', e)
    res.status(500).json({ error: 'Finalize failed' })
  }
}

keysRouter.post('/finalize-migration', firebaseAuth, finalizeMigrationHandler)
