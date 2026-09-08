import { Router, Request, Response } from 'express'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import admin from 'firebase-admin'
import { firebaseAuth, db } from '../middleware/firebaseAuth'

// ---------------------------------------------------------------------------
// Sign-In with Solana (SIWS). Own nonce map, own domain allowlist, own
// verification primitive (ed25519/base58 via tweetnacl/bs58), deliberately
// NOT shared with the Ethereum auth.ts router: a shared nonce map would make a
// Solana nonce usable to satisfy an Ethereum verify or vice versa if the two
// routers were ever merged carelessly. See spec section 5.1.
//
// Two signatures, not one (spec section 3): this file only handles SIWS
// sign-in/link. The fixed-message key-wrap derivation signature is verified
// nowhere server-side: the server never sees it, only the resulting opaque
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
 * atomically (code 6 / 'already-exists') if the document already exists.
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

/** Same relay-attack rationale as auth.ts's ALLOWED_SIWE_DOMAINS: without this
 *  check, a phishing site could get a victim to sign a message CLAIMING an
 *  allowed domain, fetch a real nonce from this server, and relay the
 *  signature to /verify or /link. */
export const ALLOWED_SIWS_DOMAINS = new Set(['myargoquest.com', 'luminalog.com'])

interface ParsedSiwsMessage {
  domain: string
  address: string
  nonce: string
}

/** Hand-rolled parser for the fixed SIWS message shape this server issues via
 *  its own /nonce endpoint and the web client's `siwsMessage.ts` builder
 *  (line 1: "{domain} wants you to sign in..."; line 2: address; a "Nonce: "
 *  line further down). No Solana equivalent of viem/siwe exists (research
 *  doc), so this is intentionally minimal rather than a general SIWS parser. */
function parseSiwsMessage(message: string): ParsedSiwsMessage | null {
  const lines = message.split('\n')
  const firstLine = lines[0] ?? ''
  const domainMatch = firstLine.match(/^(\S+) wants you to sign in with your Solana account:$/)
  const address = lines[1]?.trim()
  const nonceLine = lines.find(l => l.startsWith('Nonce: '))
  if (!domainMatch || !address || !nonceLine) return null
  return { domain: domainMatch[1], address, nonce: nonceLine.slice('Nonce: '.length).trim() }
}

interface SiwsVerifyResult { ok: true; address: string }
interface SiwsVerifyFailure { ok: false; status: number; error: string }

/** Parse, signature-verify, and nonce-consume a SIWS request. Shared by
 *  /verify and /link so both enforce the identical replay-protected check.
 *  `address` is the request body's own `address` field, checked against the
 *  message-embedded one so a caller cannot supply a validly-signed message for
 *  one address alongside a different `address` param. */
export async function verifySiwsRequest(
  message: unknown,
  signature: unknown,
  address: unknown,
): Promise<SiwsVerifyResult | SiwsVerifyFailure> {
  if (typeof message !== 'string' || message.length === 0) {
    return { ok: false, status: 400, error: 'Missing or invalid message' }
  }
  if (typeof signature !== 'string' || signature.length === 0) {
    return { ok: false, status: 400, error: 'Missing or invalid signature' }
  }
  if (typeof address !== 'string' || address.length === 0) {
    return { ok: false, status: 400, error: 'Missing or invalid address' }
  }

  const parsed = parseSiwsMessage(message)
  if (!parsed) {
    return { ok: false, status: 400, error: 'Malformed SIWS message' }
  }
  if (parsed.address !== address) {
    return { ok: false, status: 400, error: 'Address does not match signed message' }
  }
  if (!ALLOWED_SIWS_DOMAINS.has(parsed.domain)) {
    return { ok: false, status: 400, error: 'Unrecognized SIWS domain' }
  }

  let signatureValid: boolean
  try {
    const messageBytes = new TextEncoder().encode(message)
    const signatureBytes = bs58.decode(signature)
    const addressBytes = bs58.decode(address)
    signatureValid = nacl.sign.detached.verify(messageBytes, signatureBytes, addressBytes)
  } catch (e) {
    console.error('[auth/siws] signature verification threw', e)
    signatureValid = false
  }
  if (!signatureValid) {
    return { ok: false, status: 401, error: 'Invalid signature' }
  }

  if (!consumeSolanaNonce(parsed.nonce)) {
    return { ok: false, status: 401, error: 'Invalid or expired nonce' }
  }

  return { ok: true, address }
}
