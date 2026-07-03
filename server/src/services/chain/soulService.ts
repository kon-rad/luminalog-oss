import { db } from '../../middleware/firebaseAuth'
import { ensureUserWallet } from './walletService'
import { ensureMinted } from './mintService'

/**
 * Ensure the user has a CDP wallet AND a minted soulbound token.
 *
 * Designed to be called fire-and-forget from request paths (first touch / badge
 * earned): it must never block the caller, and it retries lazily on the next
 * call if a previous attempt failed. A cheap one-read short-circuit skips all
 * work once both the wallet and the token exist, so it's safe to call often.
 */
export async function ensureSoulMinted(uid: string): Promise<void> {
  const snap = await db.collection('users').doc(uid).get()
  const d = snap.data()
  if (d?.wallet?.address && d?.nft?.tokenId) return

  // Idempotent + ordered: wallet must exist before we can mint to it.
  await ensureUserWallet(uid)
  await ensureMinted(uid)
}
