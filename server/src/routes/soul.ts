import { Router, Request, Response } from 'express'
import { firebaseAuth, db } from '../middleware/firebaseAuth'
import { getConstellation, type Constellation } from '../services/constellation/constellationService'
import { ensureSoulMinted } from '../services/chain/soulService'

export interface SoulPayload {
  constellation: Constellation
  stats: { streakCount: number; totalWords: number; goalDayWords: number }
}

/** Assemble the owner's soul view: point-set + the three home-screen stats. */
export async function buildSoulPayload(uid: string): Promise<SoulPayload> {
  const constellation = (await getConstellation(uid)) ?? { version: 0, points: [] }
  const userDoc = await db.collection('users').doc(uid).get()
  const s = (userDoc.data()?.stats as Record<string, unknown>) ?? {}
  return {
    constellation,
    stats: {
      streakCount: (s.streakCount as number) ?? 0,
      totalWords: (s.totalWords as number) ?? 0,
      goalDayWords: (s.goalDayWords as number) ?? 0,
    },
  }
}

export const soulRouter = Router()
soulRouter.use(firebaseAuth)

soulRouter.get('/', async (req: Request, res: Response) => {
  const uid = (req as any).uid as string
  // First touch: provision a wallet + mint the soulbound token if needed.
  // Fire-and-forget — must never block or fail the soul view.
  ensureSoulMinted(uid).catch(err => console.error('[soul] ensureSoulMinted failed', err))
  try {
    res.json(await buildSoulPayload(uid))
  } catch (err) {
    console.error('[soul] failed to build payload', err)
    res.status(500).json({ error: 'internal' })
  }
})
