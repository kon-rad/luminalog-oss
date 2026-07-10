import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import admin from 'firebase-admin'
import { db } from '../middleware/firebaseAuth'
import { config } from '../config'

export interface WrappedDEK { v: number; iv: string; ct: string; tag: string }

/** Thrown when a user who has migrated to client-held keys (has `wrappedKeys`) has no
 *  server `wrappedDEK` — so the server must NOT regenerate one. The `/bootstrap` route
 *  maps this to 409 so the client falls through to the iCloud-key path. */
export class MigratedNoServerDEKError extends Error {
  constructor(uid: string) {
    super(`User ${uid} has migrated to client-held keys; server holds no DEK.`)
    this.name = 'MigratedNoServerDEKError'
  }
}

/** In-memory DEK cache to avoid repeated Firestore reads within a request burst. */
const cache = new Map<string, { dek: Buffer; expires: number }>()
const CACHE_MS = 5 * 60 * 1000

/**
 * Lazily decode MASTER_KEY from env on first use.
 * This avoids reading config at module top-level, keeping wrapDEK/unwrapDEK
 * unit-testable without real env vars.
 */
function master(): Buffer {
  return Buffer.from(config.MASTER_KEY, 'base64')
}

/**
 * Wrap (encrypt) a 32-byte DEK with the given master key using AES-256-GCM.
 * Pure function — no side effects, no env access.
 */
export function wrapDEK(masterKey: Buffer, dek: Buffer): WrappedDEK {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', masterKey, iv)
  const ct = Buffer.concat([c.update(dek), c.final()])
  return {
    v: 1,
    iv: iv.toString('base64'),
    ct: ct.toString('base64'),
    tag: c.getAuthTag().toString('base64'),
  }
}

/**
 * Unwrap (decrypt) a WrappedDEK with the given master key.
 * Throws if the tag doesn't authenticate (wrong key or tampered ciphertext).
 * Pure function — no side effects, no env access.
 */
export function unwrapDEK(masterKey: Buffer, w: WrappedDEK): Buffer {
  const d = createDecipheriv('aes-256-gcm', masterKey, Buffer.from(w.iv, 'base64'))
  d.setAuthTag(Buffer.from(w.tag, 'base64'))
  return Buffer.concat([d.update(Buffer.from(w.ct, 'base64')), d.final()])
}

/**
 * Get the DEK for a user, creating one idempotently inside a Firestore
 * transaction if it does not yet exist.  Results are cached in-process.
 */
export async function getOrCreateDEK(uid: string): Promise<Buffer> {
  const hit = cache.get(uid)
  if (hit && hit.expires > Date.now()) return hit.dek

  const ref = db.collection('users').doc(uid)
  const dek = await db.runTransaction(async tx => {
    const snap = await tx.get(ref)
    const existing = snap.get('wrappedDEK') as WrappedDEK | undefined
    if (existing) return unwrapDEK(master(), existing)
    // No server wrap. If the user has MIGRATED to client-held keys (wrappedKeys
    // present), do NOT mint a new DEK — it would be the WRONG key for their existing
    // ciphertext. Fail loud so the client uses the iCloud-key path instead of getting
    // silently corrupted data. (This is what makes the 1d finalize safe.)
    if (snap.get('wrappedKeys')) throw new MigratedNoServerDEKError(uid)
    const fresh = randomBytes(32)
    tx.set(ref, { wrappedDEK: wrapDEK(master(), fresh), keyVersion: 1 }, { merge: true })
    return fresh
  })

  cache.set(uid, { dek, expires: Date.now() + CACHE_MS })
  return dek
}

/**
 * Destroy a user's DEK by deleting the wrappedDEK field in Firestore and
 * evicting the in-process cache entry (crypto-shredding).
 */
export async function cryptoShredUser(uid: string): Promise<void> {
  cache.delete(uid)
  await db.collection('users').doc(uid).update({
    wrappedDEK: admin.firestore.FieldValue.delete(),
  })
}
