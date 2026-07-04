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
  opts: { stars: number; streak: number; maxStreak: number; totalWords: number; imageUrl?: string; username?: string },
): NftMetadata {
  const owner = opts.username?.trim() ? `${opts.username.trim()}'s` : 'A'
  return {
    name: `LuminaLog Soul #${tokenId}`,
    description: `${owner} constellation grown from ${opts.stars} ${opts.stars === 1 ? 'day' : 'days'} of journaling.`,
    image: opts.imageUrl || `${WEB_BASE}/soul/${tokenId}/hero.png`,
    animation_url: `${WEB_BASE}/soul/${tokenId}`,
    attributes: [
      { trait_type: 'Stars', value: opts.stars },
      { trait_type: 'Day streak', value: opts.streak },
      { trait_type: 'Max streak', value: opts.maxStreak },
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
  // displayName is stored plaintext (used for greetings); first name only.
  const username = ((data.displayName as string) ?? '').trim().split(/\s+/)[0] || undefined
  return buildNftMetadata(tokenId, {
    stars: Array.isArray(constellation.points) ? constellation.points.length : 0,
    streak: (stats.streakCount as number) ?? 0,
    maxStreak: (stats.maxStreakCount as number) ?? 0,
    totalWords: (stats.totalWords as number) ?? 0,
    imageUrl: constellation.imageUrl as string | undefined,
    username,
  })
}

/** A published-safe star: geometry + size only. NO date/dayIndex/streak/text —
 *  the temporal fields are stripped so the public viewer can't reconstruct WHEN
 *  the user journaled (privacy rule R1). The 3 coordinates are a lossy,
 *  non-invertible projection and are safe to publish (see spec privacy analysis). */
export interface PublicPoint {
  x: number
  y: number
  z: number
  wordCount: number
}

export interface PublicSoul {
  tokenId: string
  stars: number
  points: PublicPoint[]
}

/** Public point-set for a token — powers the interactive `/soul/:tokenId` galaxy.
 *  Returns null if no user holds the token. */
export async function getPublicPoints(tokenId: string): Promise<PublicSoul | null> {
  const snap = await db.collection('users').where('nft.tokenId', '==', tokenId).limit(1).get()
  if (snap.empty) return null

  const constellation = (snap.docs[0].data() as any).constellation ?? {}
  const raw = Array.isArray(constellation.points) ? constellation.points : []
  const points: PublicPoint[] = raw.map((p: any) => ({
    x: p.x,
    y: p.y,
    z: p.z,
    wordCount: typeof p.wordCount === 'number' ? p.wordCount : 0,
  }))
  return { tokenId, stars: points.length, points }
}

export const nftRouter = Router()

// GET /v1/nft/:tokenId/points — public coordinates-only point-set for the galaxy.
nftRouter.get('/:tokenId/points', async (req: Request, res: Response) => {
  if (!/^\d+$/.test(req.params.tokenId)) return res.status(404).json({ error: 'not found' })
  try {
    const soul = await getPublicPoints(req.params.tokenId)
    if (!soul) return res.status(404).json({ error: 'not found' })
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.json(soul)
  } catch (err) {
    console.error('[nft] points failed', err)
    res.status(500).json({ error: 'internal' })
  }
})

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
