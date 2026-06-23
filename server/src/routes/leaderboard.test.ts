import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mutable query results the mocked db returns, keyed by orderBy field.
const results: Record<string, any[]> = { 'stats.maxStreakCount': [], 'stats.totalWords': [] }
let queryCount = 0

vi.mock('../middleware/firebaseAuth', () => ({
  firebaseAuth: (req: any, _res: any, next: any) => { req.uid = 'u'; next() },
  db: {
    collection: () => ({
      orderBy: (field: string) => ({
        limit: () => ({
          get: async () => {
            queryCount += 1
            return { docs: results[field] ?? [] }
          },
        }),
      }),
    }),
  },
}))

import {
  leaderboardHandler,
  buildBoard,
  sanitizePhotoURL,
  __resetLeaderboardCache,
} from './leaderboard'

function mockRes() {
  const res: any = { statusCode: 200 }
  res.status = (c: number) => { res.statusCode = c; return res }
  res.json = (b: any) => { res.body = b; return res }
  return res
}
function userDoc(id: string, over: any = {}) {
  return { id, data: () => ({ displayName: 'Sam', photoURL: 'https://x/p.jpg', stats: { maxStreakCount: 5, totalWords: 100 }, ...over }) }
}

beforeEach(() => {
  results['stats.maxStreakCount'] = []
  results['stats.totalWords'] = []
  queryCount = 0
  __resetLeaderboardCache()
})

describe('sanitizePhotoURL', () => {
  it('keeps http(s) URLs', () => {
    expect(sanitizePhotoURL('https://x/p.jpg')).toBe('https://x/p.jpg')
    expect(sanitizePhotoURL('http://x/p.jpg')).toBe('http://x/p.jpg')
  })
  it('drops encrypted S3 keys and non-strings', () => {
    expect(sanitizePhotoURL('users/u/journals/profile/image-1.jpg')).toBeNull()
    expect(sanitizePhotoURL(undefined)).toBeNull()
    expect(sanitizePhotoURL(42)).toBeNull()
  })
})

describe('buildBoard', () => {
  it('numbers ranks from 1 and reads the requested stat field', () => {
    const board = buildBoard([userDoc('a'), userDoc('b')], 'maxStreakCount')
    expect(board[0]).toEqual({ rank: 1, userId: 'a', displayName: 'Sam', photoURL: 'https://x/p.jpg', value: 5 })
    expect(board[1].rank).toBe(2)
  })
  it('falls back to 0 value and empty displayName, null photo', () => {
    const doc = { id: 'c', data: () => ({ photoURL: 'users/c/x.jpg' }) }
    const board = buildBoard([doc], 'totalWords')
    expect(board[0]).toEqual({ rank: 1, userId: 'c', displayName: '', photoURL: null, value: 0 })
  })
})

describe('leaderboardHandler', () => {
  it('returns both boards from the ordered queries', async () => {
    results['stats.maxStreakCount'] = [userDoc('a', { stats: { maxStreakCount: 9, totalWords: 1 } })]
    results['stats.totalWords'] = [userDoc('b', { stats: { maxStreakCount: 1, totalWords: 900 } })]
    const res = mockRes()
    await leaderboardHandler({ uid: 'u' } as any, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.streak[0]).toMatchObject({ userId: 'a', value: 9 })
    expect(res.body.words[0]).toMatchObject({ userId: 'b', value: 900 })
  })

  it('serves a cached payload within the TTL (no re-query)', async () => {
    const res1 = mockRes()
    await leaderboardHandler({ uid: 'u' } as any, res1)
    const afterFirst = queryCount
    const res2 = mockRes()
    await leaderboardHandler({ uid: 'u' } as any, res2)
    expect(queryCount).toBe(afterFirst) // second call hit the cache
  })
})
