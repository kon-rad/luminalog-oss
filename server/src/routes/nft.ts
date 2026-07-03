import { Router, Request, Response } from 'express'
import { db } from '../middleware/firebaseAuth'

/** Public web app base — hosts the interactive galaxy + hero PNG. */
const WEB_BASE = 'https://luminalog.com'

/** Standard ERC-721 metadata. Deliberately contains NO coordinates, vectors, or
 *  text — only aggregate counts + rendered image. This is the privacy boundary:
 *  the endpoint is public/unauthenticated (wallets + marketplaces fetch it). */
export interface NftMetadata {
  name: string
  description: string
  image: string
  animation_url: string
  attributes: { trait_type: string; value: number }[]
}

export function buildNftMetadata(
  tokenId: string,
  opts: { stars: number; streak: number; totalWords: number; imageUrl?: string },
): NftMetadata {
  return {
    name: `LuminaLog Soul #${tokenId}`,
    description: `A constellation grown from ${opts.stars} ${opts.stars === 1 ? 'day' : 'days'} of journaling.`,
    image: opts.imageUrl || `${WEB_BASE}/soul/${tokenId}/hero.png`,
    animation_url: `${WEB_BASE}/soul/${tokenId}`,
    attributes: [
      { trait_type: 'Stars', value: opts.stars },
      { trait_type: 'Day streak', value: opts.streak },
      { trait_type: 'Total words', value: opts.totalWords },
    ],
  }
}

/**
 * Look up the holder of `tokenId` and assemble published-safe metadata from
 * their constellation point-set (count only) + aggregate stats. Returns null if
 * no user holds the token. Reads ONLY published-safe fields.
 */
export async function getNftMetadata(tokenId: string): Promise<NftMetadata | null> {
  const snap = await db.collection('users').where('nft.tokenId', '==', tokenId).limit(1).get()
  if (snap.empty) return null

  const data = snap.docs[0].data() as any
  const constellation = data.constellation ?? {}
  const stats = data.stats ?? {}
  return buildNftMetadata(tokenId, {
    stars: Array.isArray(constellation.points) ? constellation.points.length : 0,
    streak: (stats.streakCount as number) ?? 0,
    totalWords: (stats.totalWords as number) ?? 0,
    imageUrl: constellation.imageUrl as string | undefined,
  })
}

export const nftRouter = Router()

// GET /v1/nft/:tokenId.json — matches the on-chain tokenURI (baseURI + id + ".json").
// Public: no firebaseAuth. Parse the ".json" suffix ourselves for robustness.
nftRouter.get('/:file', async (req: Request, res: Response) => {
  const m = /^(\d+)\.json$/.exec(req.params.file)
  if (!m) return res.status(404).json({ error: 'not found' })
  try {
    const meta = await getNftMetadata(m[1])
    if (!meta) return res.status(404).json({ error: 'not found' })
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.json(meta)
  } catch (err) {
    console.error('[nft] metadata failed', err)
    res.status(500).json({ error: 'internal' })
  }
})
