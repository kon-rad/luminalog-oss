import { Router, Request, Response } from 'express'
import { createPublicClient, http, type Chain } from 'viem'
import * as chains from 'viem/chains'
import { generateSiweNonce, parseSiweMessage } from 'viem/siwe'
import { firebaseAuth } from '../middleware/firebaseAuth'

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

export const authRouter = Router()
authRouter.get('/siwe/nonce', nonceHandler)
