import { Router, Request, Response } from 'express'
import { firebaseAuth, db } from '../middleware/firebaseAuth'

export const leaderboardRouter = Router()

const LIMIT = 100
const CACHE_TTL_MS = 60_000

export interface LeaderboardEntry {
  rank: number
  userId: string
  displayName: string
  photoURL: string | null
  value: number
}

interface Payload {
  streak: LeaderboardEntry[]
  words: LeaderboardEntry[]
  prompts: LeaderboardEntry[]
}

let cache: { expiresAt: number; payload: Payload } | null = null

/** Provider (http/https) photos are public; encrypted S3-key photoURLs are not. */
export function sanitizePhotoURL(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  return /^https?:\/\//i.test(raw) ? raw : null
}

type StatField = 'maxStreakCount' | 'totalWords' | 'promptsAnswered'

export function buildBoard(
  docs: Array<{ id: string; data: () => any }>,
  statField: StatField,
): LeaderboardEntry[] {
  return docs.map((d, i) => {
    const data = d.data() ?? {}
    const stats = (data.stats as Record<string, unknown>) ?? {}
    const raw = stats[statField]
    return {
      rank: i + 1,
      userId: d.id,
      displayName: typeof data.displayName === 'string' ? data.displayName : '',
      photoURL: sanitizePhotoURL(data.photoURL),
      value: typeof raw === 'number' ? raw : 0,
    }
  })
}

export function __resetLeaderboardCache(): void {
  cache = null
}

export async function leaderboardHandler(_req: Request, res: Response): Promise<void> {
  const now = Date.now()
  if (cache && cache.expiresAt > now) {
    res.json(cache.payload)
    return
  }
  try {
    const [streakSnap, wordsSnap, promptsSnap] = await Promise.all([
      db.collection('users').orderBy('stats.maxStreakCount', 'desc').limit(LIMIT).get(),
      db.collection('users').orderBy('stats.totalWords', 'desc').limit(LIMIT).get(),
      db.collection('users').orderBy('stats.promptsAnswered', 'desc').limit(LIMIT).get(),
    ])
    const payload: Payload = {
      streak: buildBoard(streakSnap.docs, 'maxStreakCount'),
      words: buildBoard(wordsSnap.docs, 'totalWords'),
      prompts: buildBoard(promptsSnap.docs, 'promptsAnswered'),
    }
    cache = { expiresAt: now + CACHE_TTL_MS, payload }
    res.json(payload)
  } catch (err) {
    console.error('[leaderboards]', err)
    res.status(500).json({ error: 'Failed to load leaderboards' })
  }
}

leaderboardRouter.get('/', firebaseAuth, leaderboardHandler)
