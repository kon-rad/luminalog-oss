import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { isEncryptedField } from '@/lib/crypto/envelope'

// Shared spies for the mocked Firestore transaction/getDoc/setDoc surface.
const mocks = vi.hoisted(() => ({
  getTx: vi.fn(),
  setTx: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  dek: null as CryptoKey | null,
}))

vi.mock('@/lib/firebase', () => ({
  auth: {
    get currentUser() {
      return { uid: 'user-abc', displayName: null, email: null, photoURL: null }
    },
  },
  db: { __db: true },
}))

vi.mock('@/lib/crypto/dek', () => ({
  getCachedDEK: () => mocks.dek,
  bootstrapDEK: async () => mocks.dek,
}))

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>()
  return {
    ...actual,
    doc: vi.fn(() => ({ __ref: 'users/user-abc' })),
    getDoc: (...args: unknown[]) => mocks.getDoc(...args),
    setDoc: (...args: unknown[]) => mocks.setDoc(...args),
    onSnapshot: vi.fn(),
    runTransaction: vi.fn(async (_db: unknown, cb: (tx: unknown) => Promise<void>) =>
      cb({ get: mocks.getTx, set: mocks.setTx }),
    ),
  }
})

import { buildUserSeed, ensureUserDocument, recordEntrySaved } from '@/lib/firestore/profile'

let key: CryptoKey

beforeAll(async () => {
  key = await crypto.subtle.importKey('raw', new Uint8Array(32), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ])
  mocks.dek = key
})

beforeEach(() => {
  mocks.getTx.mockReset()
  mocks.setTx.mockReset()
  mocks.getDoc.mockReset()
  mocks.setDoc.mockReset()
})

describe('buildUserSeed (design §5 exact seed)', () => {
  it('produces exactly the seed fields, with an encrypted empty biography and all-zero counters', async () => {
    const seed = await buildUserSeed({ displayName: null, email: null, photoURL: null }, key)

    // Exact key set — no nulls, no later-milestone keys.
    expect(Object.keys(seed).sort()).toEqual(
      ['biography', 'createdAt', 'displayName', 'email', 'stats', 'storage', 'timezone', 'totalMinutesInApp'].sort(),
    )
    expect('dailyPrompt' in seed).toBe(false)
    expect('summaryConfig' in seed).toBe(false)
    expect('profileDetails' in seed).toBe(false)
    expect('lastEntryDate' in seed).toBe(false)
    expect('goalDayDate' in seed).toBe(false)
    expect('photoURL' in seed).toBe(false)

    // Plaintext identity fall back to ''.
    expect(seed.displayName).toBe('')
    expect(seed.email).toBe('')
    expect(seed.totalMinutesInApp).toBe(0)

    // biography is an EncryptedField envelope of the empty string.
    expect(isEncryptedField(seed.biography)).toBe(true)

    // stats: five zero counters, no date keys.
    expect(seed.stats).toEqual({
      streakCount: 0,
      maxStreakCount: 0,
      totalWords: 0,
      goalDayWords: 0,
      promptsAnswered: 0,
    })

    // storage: all-zero.
    expect(seed.storage).toEqual({
      audioBytes: 0,
      audioCount: 0,
      imageBytes: 0,
      imageCount: 0,
      videoBytes: 0,
      videoCount: 0,
    })

    // timezone is a non-empty IANA string; createdAt is a Firestore Timestamp.
    expect(typeof seed.timezone).toBe('string')
    expect((seed.timezone as string).length).toBeGreaterThan(0)
    expect(typeof (seed.createdAt as { toDate?: unknown }).toDate).toBe('function')
  })

  it('uses the auth display name/email and includes photoURL only when present', async () => {
    const seed = await buildUserSeed(
      { displayName: 'Ada', email: 'ada@example.com', photoURL: 'https://x/a.png' },
      key,
    )
    expect(seed.displayName).toBe('Ada')
    expect(seed.email).toBe('ada@example.com')
    expect(seed.photoURL).toBe('https://x/a.png')
  })
})

describe('ensureUserDocument', () => {
  it('returns false and never writes when the doc already exists', async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => true })

    const isNew = await ensureUserDocument()

    expect(isNew).toBe(false)
    expect(mocks.setDoc).not.toHaveBeenCalled()
  })

  it('seeds with merge:true and returns true for a new user', async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => false })

    const isNew = await ensureUserDocument()

    expect(isNew).toBe(true)
    expect(mocks.setDoc).toHaveBeenCalledTimes(1)
    const [, seed, options] = mocks.setDoc.mock.calls[0]
    expect(options).toEqual({ merge: true })
    expect(isEncryptedField((seed as Record<string, unknown>).biography)).toBe(true)
    expect(seed).toHaveProperty('stats')
  })
})

describe('recordEntrySaved stats transaction (design §8)', () => {
  it('credits the streak once when a first-ever entry crosses the 750-word goal', async () => {
    // Fresh user: no stats yet, UTC timezone stored.
    mocks.getTx.mockResolvedValue({
      data: () => ({ timezone: 'UTC', stats: {} }),
    })

    await recordEntrySaved(750, new Date('2026-06-10T12:00:00.000Z'))

    expect(mocks.setTx).toHaveBeenCalledTimes(1)
    const [, payload, options] = mocks.setTx.mock.calls[0]
    expect(options).toEqual({ merge: true })

    const stats = (payload as { stats: Record<string, unknown> }).stats
    expect(stats.streakCount).toBe(1)
    expect(stats.maxStreakCount).toBe(1)
    expect(stats.totalWords).toBe(750)
    expect(stats.goalDayWords).toBe(750)
    // goalDayDate + lastEntryDate written as Timestamps once the goal is met.
    expect(typeof (stats.goalDayDate as { toDate?: unknown }).toDate).toBe('function')
    expect(typeof (stats.lastEntryDate as { toDate?: unknown }).toDate).toBe('function')
  })

  it('does not advance the streak for a sub-goal entry', async () => {
    mocks.getTx.mockResolvedValue({
      data: () => ({ timezone: 'UTC', stats: {} }),
    })

    await recordEntrySaved(100, new Date('2026-06-10T12:00:00.000Z'))

    const [, payload] = mocks.setTx.mock.calls[0]
    const stats = (payload as { stats: Record<string, unknown> }).stats
    expect(stats.streakCount).toBe(0)
    expect(stats.totalWords).toBe(100)
    expect(stats.goalDayWords).toBe(100)
    expect('lastEntryDate' in stats).toBe(false)
  })
})
