import { Router, Request, Response } from 'express'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import admin from 'firebase-admin'
import { firebaseAuth, db } from '../middleware/firebaseAuth'

// ---------------------------------------------------------------------------
// Sign-In with Solana (SIWS). Own nonce map, own domain allowlist, own
// verification primitive (ed25519/base58 via tweetnacl/bs58) -- deliberately
// NOT shared with the Ethereum auth.ts router: a shared nonce map would make a
// Solana nonce usable to satisfy an Ethereum verify or vice versa if the two
// routers were ever merged carelessly. See spec section 5.1.
//
// Two signatures, not one (spec section 3): this file only handles SIWS
// sign-in/link. The fixed-message key-wrap derivation signature is verified
// nowhere server-side -- the server never sees it, only the resulting opaque
// wrap envelope via keys.ts.
// ---------------------------------------------------------------------------

const NONCE_TTL_MS = 5 * 60 * 1000
const solanaNonces = new Map<string, number>() // nonce -> issuedAt (epoch ms)

function sweepExpiredSolanaNonces(now: number): void {
  for (const [nonce, issuedAt] of solanaNonces) {
    if (now - issuedAt > NONCE_TTL_MS) solanaNonces.delete(nonce)
  }
}

/** Issue a fresh, unconsumed nonce. Sweeps expired entries first so the map
 *  cannot grow unboundedly from abandoned sign-in attempts. */
export function issueSolanaNonce(): string {
  const now = Date.now()
  sweepExpiredSolanaNonces(now)
  // 16 random bytes, base58-encoded: plenty of entropy, and base58 keeps the
  // nonce safe to embed directly in the SIWS message text (no URL/whitespace
  // escaping concerns).
  const nonce = bs58.encode(nacl.randomBytes(16))
  solanaNonces.set(nonce, now)
  return nonce
}

/** Consume a nonce: true only if it was issued and is still within its TTL.
 *  Always deletes it, so a nonce can never be consumed twice. */
export function consumeSolanaNonce(nonce: string): boolean {
  const issuedAt = solanaNonces.get(nonce)
  if (issuedAt === undefined) return false
  solanaNonces.delete(nonce)
  return Date.now() - issuedAt <= NONCE_TTL_MS
}

export async function solanaNonceHandler(_req: Request, res: Response): Promise<void> {
  res.json({ nonce: issueSolanaNonce() })
}

/**
 * Race-safe uid resolution for a Solana address. A plain Firestore
 * transaction cannot close this race on its own: `admin.auth().createUser()`
 * is an external Auth API call, not a Firestore read/write, so it cannot run
 * inside a `db.runTransaction()` callback. Instead, `walletLinksSolana/{address}`
 * acts as the atomicity anchor via `DocumentReference.create()`, which fails
 * atomically (code 6 / 'already-exists') if the document already exists --
 * Firestore guarantees only one concurrent `create()` on the same document
 * path succeeds, with no transaction needed. See spec's "Race-safe uid
 * resolution" subsection.
 *
 * On the losing side of a race, this returns the WINNER's uid; the loser's
 * freshly-created Firebase Auth user becomes a harmless orphan (no wallet
 * address ever attaches to it), an acceptable non-destructive tradeoff.
 */
export async function resolveOrCreateUid(address: string): Promise<string> {
  const linkRef = db.collection('walletLinksSolana').doc(address)
  const existing = await linkRef.get()
  if (existing.exists) return existing.get('uid') as string

  const created = await admin.auth().createUser({})
  try {
    await linkRef.create({ uid: created.uid })
  } catch (e: any) {
    if (e.code === 6 || e.code === 'already-exists') {
      const winner = await linkRef.get()
      return winner.get('uid') as string
    }
    throw e
  }
  await db.collection('users').doc(created.uid).set({ walletAddressSolana: address }, { merge: true })
  return created.uid
}
