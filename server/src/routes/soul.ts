import { Router, Request, Response } from 'express'
import { firebaseAuth, db } from '../middleware/firebaseAuth'
import { getConstellation, type Constellation } from '../services/constellation/constellationService'
import { ensureSoulMinted } from '../services/chain/soulService'

export interface SoulNft {
  tokenId: string
  contract: string
  chain: string
  walletAddress: string
  txHash: string | null
}

export interface SoulPayload {
  constellation: Constellation
  stats: { streakCount: number; totalWords: number; goalDayWords: number }
  nft: SoulNft | null
}

/** Assemble the owner's soul view: point-set + the three home-screen stats + the
 *  soulbound NFT (wallet address + tokenId) once it has been minted. */
export async function buildSoulPayload(uid: string): Promise<SoulPayload> {
  const constellation = (await getConstellation(uid)) ?? { version: 0, points: [] }
  const userDoc = await db.collection('users').doc(uid).get()
  const data = userDoc.data() ?? {}
  const s = (data.stats as Record<string, unknown>) ?? {}
  const nftDoc = data.nft as Record<string, unknown> | undefined
  const wallet = data.wallet as Record<string, unknown> | undefined

  const nft: SoulNft | null =
    nftDoc?.tokenId != null
      ? {
          tokenId: String(nftDoc.tokenId),
          contract: (nftDoc.contract as string) ?? '',
          chain: (nftDoc.chain as string) ?? 'base-sepolia',
          walletAddress:
            (wallet?.address as string) ?? (nftDoc.walletAddress as string) ?? '',
          txHash: (nftDoc.txHash as string) ?? null,
        }
      : null

  return {
    constellation,
    stats: {
      streakCount: (s.streakCount as number) ?? 0,
      totalWords: (s.totalWords as number) ?? 0,
      goalDayWords: (s.goalDayWords as number) ?? 0,
    },
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
