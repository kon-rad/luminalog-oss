import { Router, Request, Response } from 'express'
import { firebaseAuth, db } from '../middleware/firebaseAuth'
import { getConstellation, type Constellation, type ConstellationPoint } from '../services/constellation/constellationService'
import { ensureSoulMinted, refreshSoulImage } from '../services/chain/soulService'
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

const MAX_POINTS = 5000

function isValidPoint(p: any): p is ConstellationPoint {
  return p && typeof p === 'object'
    && Number.isInteger(p.dayIndex)
    && typeof p.date === 'string' && p.date.length > 0
    && Number.isFinite(p.x) && p.x >= -1 && p.x <= 1
    && Number.isFinite(p.y) && p.y >= -1 && p.y <= 1
    && Number.isFinite(p.z) && p.z >= -1 && p.z <= 1
    && Number.isInteger(p.wordCount) && p.wordCount >= 0
    && Number.isInteger(p.streakAtEarn) && p.streakAtEarn >= 0
}

/** Blind coordinate sink for the on-device anchored soul constellation: no
 *  embeddings ever reach the server, only the 3 projected coordinates + word
 *  count per day. Ownership comes from the auth token, never the body. */
export async function putConstellationHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string
  const body = req.body as { points?: unknown }
  if (!Array.isArray(body?.points) || body.points.length > MAX_POINTS) {
    res.status(400).json({ error: 'Missing or invalid points (array)' })
    return
  }
  const points = body.points as unknown[]
  if (!points.every(isValidPoint)) {
    res.status(400).json({ error: 'One or more points are malformed' })
    return
  }
  const sanitized: ConstellationPoint[] = points.map((p) => {
    const pt = p as ConstellationPoint
    return {
      dayIndex: pt.dayIndex,
      date: pt.date,
      x: pt.x,
      y: pt.y,
      z: pt.z,
      wordCount: pt.wordCount,
      streakAtEarn: pt.streakAtEarn,
    }
  })
  const userRef = db.collection('users').doc(uid)
  let version: number
  try {
    const snap = await userRef.get()
    const prevVersion = ((snap.data()?.constellation as Constellation | undefined)?.version) ?? 0
    version = prevVersion + 1
    await userRef.set({ constellation: { version, points: sanitized } }, { merge: true })
  } catch (err) {
    console.error('[soul] failed to persist constellation', err)
    res.status(500).json({ error: 'internal' })
    return
  }
  refreshSoulImage(uid).catch((err) => console.error('[soul] refreshSoulImage failed', err))
  res.status(200).json({ version, count: sanitized.length })
}

soulRouter.put('/constellation', putConstellationHandler)
