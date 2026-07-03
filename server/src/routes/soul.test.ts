import { describe, it, expect, vi, beforeEach } from 'vitest'

const userData: Record<string, any> = {}
vi.mock('../middleware/firebaseAuth', () => ({
  firebaseAuth: (_req: any, _res: any, next: any) => next(),
  db: { collection: () => ({ doc: (uid: string) => ({ async get() { return { data: () => userData[uid] } } }) }) },
}))
const getConstellation = vi.fn()
vi.mock('../services/constellation/constellationService', () => ({
  getConstellation: (...a: any[]) => getConstellation(...a),
}))
// soul.ts fires ensureSoulMinted on GET; mock it so the test doesn't pull in the
// real chain stack (walletService → config, which process.exits without env).
vi.mock('../services/chain/soulService', () => ({ ensureSoulMinted: vi.fn() }))

import { buildSoulPayload } from './soul'

beforeEach(() => {
  for (const k of Object.keys(userData)) delete userData[k]
  getConstellation.mockReset()
})

describe('buildSoulPayload', () => {
  it('returns an empty constellation and zeroed stats for a new user', async () => {
    getConstellation.mockResolvedValue(null)
    userData['u1'] = {}
    expect(await buildSoulPayload('u1')).toEqual({
      constellation: { version: 0, points: [] },
      stats: { streakCount: 0, totalWords: 0, goalDayWords: 0 },
    })
  })

  it('returns the point-set and stats, exposing no vectors', async () => {
    getConstellation.mockResolvedValue({ version: 3, points: [{ dayIndex: 1, date: '2026-07-01', x: 0, y: 0, z: 0, wordCount: 800, streakAtEarn: 1 }] })
    userData['u1'] = { stats: { streakCount: 5, totalWords: 12345, goalDayWords: 800 } }
    const payload = await buildSoulPayload('u1')
    expect(payload.constellation.version).toBe(3)
    expect(payload.stats).toEqual({ streakCount: 5, totalWords: 12345, goalDayWords: 800 })
    expect(JSON.stringify(payload)).not.toContain('vector')
  })
})
