import { Router, Request, Response } from 'express'
import { firebaseAuth, db } from '../middleware/firebaseAuth'
import { getConstellation, type Constellation } from '../services/constellation/constellationService'
import { ensureSoulMinted } from '../services/chain/soulService'
import { config } from '../config'

export interface SoulWallet {
  address: string
  chain: string
}

export interface SoulNft {
  tokenId: string
  contract: string
  chain: string
  walletAddress: string
  txHash: string | null
}

export interface SoulPayload {
  constellation: Constellation
  stats: { streakCount: number; maxStreakCount: number; totalWords: number; goalDayWords: number }
  /** The custodial wallet, present as soon as it is provisioned — BEFORE and
   *  independent of minting — so the app can show the address + explorer link
   *  during the (possibly slow or failed) mint. Null only until the wallet exists. */
  wallet: SoulWallet | null
  nft: SoulNft | null
}

/** Assemble the owner's soul view: point-set + the three home-screen stats + the
 *  custodial wallet (once provisioned) + the soulbound NFT (once minted). The
 *  wallet is surfaced separately from `nft` so the address is visible during the
 *  window between wallet provisioning and mint completion. */
export async function buildSoulPayload(uid: string): Promise<SoulPayload> {
  const constellation = (await getConstellation(uid)) ?? { version: 0, points: [] }
  const userDoc = await db.collection('users').doc(uid).get()
  const data = userDoc.data() ?? {}
  const s = (data.stats as Record<string, unknown>) ?? {}
  const nftDoc = data.nft as Record<string, unknown> | undefined
  const walletDoc = data.wallet as Record<string, unknown> | undefined

  const walletAddress =
    (walletDoc?.address as string) ?? (nftDoc?.walletAddress as string) ?? ''
  // Chain host for the address explorer link: authoritative from the minted nft,
  // else the wallet doc, else the server's configured chain (BASE_CHAIN).
  const chain =
    (nftDoc?.chain as string) ?? (walletDoc?.chain as string) ?? config.BASE_CHAIN

  const wallet: SoulWallet | null = walletAddress ? { address: walletAddress, chain } : null

  const nft: SoulNft | null =
    nftDoc?.tokenId != null
      ? {
          tokenId: String(nftDoc.tokenId),
          contract: (nftDoc.contract as string) ?? '',
          chain: (nftDoc.chain as string) ?? config.BASE_CHAIN,
          walletAddress,
          txHash: (nftDoc.txHash as string) ?? null,
        }
      : null

  return {
    constellation,
    stats: {
      streakCount: (s.streakCount as number) ?? 0,
      maxStreakCount: (s.maxStreakCount as number) ?? 0,
      totalWords: (s.totalWords as number) ?? 0,
      goalDayWords: (s.goalDayWords as number) ?? 0,
    },
    wallet,
    nft,
  }
}

export const soulRouter = Router()
soulRouter.use(firebaseAuth)

soulRouter.get('/', async (req: Request, res: Response) => {
  const uid = (req as any).uid as string
  // First touch: provision a wallet + mint the soulbound token if needed.
  // Fire-and-forget — must never block or fail the soul view.
  ensureSoulMinted(uid).catch(err =>
    console.error('[soul] ensureSoulMinted failed', err?.message ?? String(err)),
  )
  try {
    res.json(await buildSoulPayload(uid))
  } catch (err) {
    console.error('[soul] failed to build payload', err)
    res.status(500).json({ error: 'internal' })
  }
})
