import { db } from '../../middleware/firebaseAuth'
import { ensureUserWallet } from './walletService'
import { ensureMinted } from './mintService'
import { renderAndStoreSoulImage, type Point3D } from './soulImage'

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

/**
 * Re-render the hero PNG from the user's current point-set and persist its URL on
 * `constellation.imageUrl`. No-op until the token is minted (the image is keyed
 * by tokenId). Call after a badge recompute so the NFT image tracks the galaxy —
 * the on-chain `tokenURI` is dynamic, so this update costs no gas. Merge-writes
 * only `imageUrl`, leaving `version`/`points` untouched.
 */
export async function refreshSoulImage(uid: string): Promise<void> {
  const ref = db.collection('users').doc(uid)
  const d = (await ref.get()).data()
  const tokenId = d?.nft?.tokenId as string | undefined
  if (!tokenId) return // not minted yet — the next badge (post-mint) will render it

  const points = (d?.constellation?.points ?? []) as Point3D[]
  const imageUrl = await renderAndStoreSoulImage(tokenId, points)
  await ref.set({ constellation: { imageUrl } }, { merge: true })
}
