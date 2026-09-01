import { Router, Request, Response } from 'express'
import { createPublicClient, http, type Chain } from 'viem'
import * as chains from 'viem/chains'
import { generateSiweNonce, parseSiweMessage } from 'viem/siwe'
import admin from 'firebase-admin'
import { firebaseAuth, db } from '../middleware/firebaseAuth'

// ---------------------------------------------------------------------------
// Sign-In with Ethereum (EIP-4361). Two signatures, not one: SIWE sign-in
// needs a server nonce (replay protection); the EOA key-wrap derivation
// (spec section 6, a later stage) needs a fixed message with no nonce. This
// file only handles SIWE sign-in and linking.
//
// Nonce storage is an in-memory TTL map (single Express process, nonces live
// seconds to minutes). No new persistent collection.
// ---------------------------------------------------------------------------

const NONCE_TTL_MS = 5 * 60 * 1000
const nonces = new Map<string, number>() // nonce -> issuedAt (epoch ms)

function sweepExpiredNonces(now: number): void {
  for (const [nonce, issuedAt] of nonces) {
    if (now - issuedAt > NONCE_TTL_MS) nonces.delete(nonce)
  }
}

/** Issue a fresh, unconsumed nonce. Sweeps expired entries first so the map
 *  cannot grow unboundedly from abandoned sign-in attempts. */
export function issueNonce(): string {
  const now = Date.now()
  sweepExpiredNonces(now)
  const nonce = generateSiweNonce()
  nonces.set(nonce, now)
  return nonce
}

/** Consume a nonce: true only if it was issued and is still within its TTL.
 *  Always deletes it, so a nonce can never be consumed twice (replay
 *  protection holds even if the caller re-sends the same request). */
export function consumeNonce(nonce: string): boolean {
  const issuedAt = nonces.get(nonce)
  if (issuedAt === undefined) return false
  nonces.delete(nonce)
  return Date.now() - issuedAt <= NONCE_TTL_MS
}

/** A viem public client bound to the chain the SIWE message declared, so
 *  ERC-1271/6492 (smart-contract wallet) verification calls the right chain.
 *  Falls back to mainnet for an unrecognized chain id; EOA signature
 *  verification (the common case) does not depend on the chain being live. */
function clientForChain(chainId: number) {
  const chain = (Object.values(chains) as Chain[]).find(c => c.id === chainId) ?? chains.mainnet
  return createPublicClient({ chain, transport: http() })
}

export async function nonceHandler(_req: Request, res: Response): Promise<void> {
  res.json({ nonce: issueNonce() })
}

/** Web app domains that may issue a SIWE message accepted by this server.
 *  Both currently serve luminalog-web during the myargoquest.com rebrand
 *  (workspace CLAUDE.md), and iOS shares the same domain string per spec
 *  section 5.3 (same WalletConnect project ID as web).
 *
 *  Without this check, a phishing site could get a victim to sign a SIWE
 *  message that CLAIMS domain "myargoquest.com" (personal_sign has no
 *  binding to the actual page origin the way a browser's native crypto
 *  APIs do), fetch a real nonce from this server's public /nonce endpoint,
 *  and relay the resulting signature straight to /verify or /link to
 *  obtain a token for the victim's account. Domain binding is the
 *  EIP-4361-mandated mitigation for exactly this relay attack. */
const ALLOWED_SIWE_DOMAINS = new Set(['myargoquest.com', 'luminalog.com'])

interface SiweVerifyResult {
  ok: true
  address: string
}
interface SiweVerifyFailure {
  ok: false
  status: number
  error: string
}

/** Parse, signature-verify, and nonce-consume a SIWE request. Shared by
 *  /verify and /link so both enforce the identical replay-protected check.
 *  Returns the lower-cased address on success (storage/lookup use the
 *  lower-cased form so a query never misses on checksum-casing differences).
 *
 *  The message's expirationTime/notBefore fields are deliberately NOT checked
 *  separately: the nonce is single-use and TTL-bounded (5 minutes), which
 *  already bounds message freshness for this server's purposes. */
async function verifySiweRequest(message: unknown, signature: unknown): Promise<SiweVerifyResult | SiweVerifyFailure> {
  if (typeof message !== 'string' || message.length === 0) {
    return { ok: false, status: 400, error: 'Missing or invalid message' }
  }
  if (typeof signature !== 'string' || !signature.startsWith('0x')) {
    return { ok: false, status: 400, error: 'Missing or invalid signature' }
  }

  const parsed = parseSiweMessage(message)
  if (!parsed.address || !parsed.nonce || typeof parsed.chainId !== 'number') {
    return { ok: false, status: 400, error: 'Malformed SIWE message' }
  }

  if (!parsed.domain || !ALLOWED_SIWE_DOMAINS.has(parsed.domain)) {
    return { ok: false, status: 400, error: 'Unrecognized SIWE domain' }
  }

  let signatureValid: boolean
  try {
    const client = clientForChain(parsed.chainId)
    signatureValid = await client.verifyMessage({
      address: parsed.address,
      message,
      signature: signature as `0x${string}`,
    })
  } catch (e) {
    console.error('[auth/siwe] signature verification threw', e)
    signatureValid = false
  }
  if (!signatureValid) {
    return { ok: false, status: 401, error: 'Invalid signature' }
  }

  if (!consumeNonce(parsed.nonce)) {
    return { ok: false, status: 401, error: 'Invalid or expired nonce' }
  }

  return { ok: true, address: parsed.address.toLowerCase() }
}

// POST /v1/auth/siwe/verify: unauthenticated. Sign-in (or wallet-first
// signup): resolve users/{uid} by walletAddress, or mint a new Firebase uid
// if none exists. The wallet address is NEVER the uid on either path.
export async function verifyHandler(req: Request, res: Response): Promise<void> {
  const { message, signature } = req.body as { message?: unknown; signature?: unknown }
  const result = await verifySiweRequest(message, signature)
  if (!result.ok) {
    res.status(result.status).json({ error: result.error })
    return
  }
  try {
    const existing = await db.collection('users').where('walletAddress', '==', result.address).limit(1).get()
    let uid: string
    if (!existing.empty) {
      uid = existing.docs[0].id
    } else {
      const created = await admin.auth().createUser({})
      uid = created.uid
      await db.collection('users').doc(uid).set({ walletAddress: result.address }, { merge: true })
      await admin.auth().setCustomUserClaims(uid, { walletAddress: result.address })
    }
    const firebaseCustomToken = await admin.auth().createCustomToken(uid)
    res.json({ firebaseCustomToken })
  } catch (e) {
    console.error('[auth/siwe/verify]', e)
    res.status(500).json({ error: 'Verify failed' })
  }
}

// POST /v1/auth/siwe/link: authenticated. Attach a wallet to the CALLER's
// existing account. Rejects (409) if the address already resolves to a
// different uid, which is what keeps /verify's "resolve by walletAddress"
// lookup unambiguous. Idempotent when the caller re-links their own wallet.
export async function linkHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string
  const { message, signature } = req.body as { message?: unknown; signature?: unknown }
  const result = await verifySiweRequest(message, signature)
  if (!result.ok) {
    res.status(result.status).json({ error: result.error })
    return
  }
  try {
    const existing = await db.collection('users').where('walletAddress', '==', result.address).limit(1).get()
    if (!existing.empty && existing.docs[0].id !== uid) {
      res.status(409).json({ error: 'Wallet already linked to a different account' })
      return
    }
    await db.collection('users').doc(uid).set({ walletAddress: result.address }, { merge: true })
    const user = await admin.auth().getUser(uid)
    await admin.auth().setCustomUserClaims(uid, { ...(user.customClaims ?? {}), walletAddress: result.address })
    res.json({ walletAddress: result.address })
  } catch (e) {
    console.error('[auth/siwe/link]', e)
    res.status(500).json({ error: 'Link failed' })
  }
}

export const authRouter = Router()
authRouter.get('/siwe/nonce', nonceHandler)
authRouter.post('/siwe/verify', verifyHandler)
authRouter.post('/siwe/link', firebaseAuth, linkHandler)
