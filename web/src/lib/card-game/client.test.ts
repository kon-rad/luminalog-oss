import { vi, describe, it, expect, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiPost: vi.fn(async () => ({})),
  fetch: vi.fn(),
  updateDoc: vi.fn(async () => undefined),
  doc: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join('/') })),
  serverTimestamp: vi.fn(() => 'TS'),
}))

vi.mock('@/lib/api/client', () => ({ apiPost: mocks.apiPost }))
vi.mock('@/lib/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  doc: mocks.doc,
  updateDoc: mocks.updateDoc,
  serverTimestamp: mocks.serverTimestamp,
  onSnapshot: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn(),
  where: vi.fn(),
}))

import { flipCard, nextCard, joinRoom, restartRoom, endRoom, fetchPlaybackUrls } from './client'
import type { Room } from './room'

function room(over: Partial<Room> = {}): Room {
  return {
    code: 'ABC234',
    deckId: 'bridging-generations',
    title: '',
    hostUid: 'u1',
    hostName: 'Host',
    status: 'active',
    order: [4, 2, 7],
    drawn: 1,
    revealed: true,
    players: [],
    answerCount: 0,
    ...over,
  }
}

beforeEach(() => vi.clearAllMocks())

/** The payload passed to the most recent updateDoc call. */
const lastUpdate = () => mocks.updateDoc.mock.calls.at(-1)?.[1] as any

describe('flipCard', () => {
  it('turns the top card face up', async () => {
    await flipCard('ABC234')
    expect(lastUpdate().revealed).toBe(true)
  })

  it('stamps updatedAt so the room list can order by recency', async () => {
    await flipCard('ABC234')
    expect(lastUpdate().updatedAt).toBe('TS')
  })
})

describe('nextCard', () => {
  it('draws the next card face down', async () => {
    await nextCard('ABC234', room({ drawn: 1 }))
    expect(lastUpdate()).toMatchObject({ drawn: 2, revealed: false })
  })

  // Running off the end of a 100-card deck must not push `drawn` past the
  // order array, which would leave the table on a permanently blank card.
  it('does nothing once the deck is exhausted', async () => {
    await nextCard('ABC234', room({ drawn: 3 }))
    expect(mocks.updateDoc).not.toHaveBeenCalled()
  })
})

describe('joinRoom', () => {
  const player = { uid: 'u2', name: 'Grace', photoURL: null }

  it('appends a player who is not yet seated', async () => {
    await joinRoom('ABC234', room(), player)
    expect(lastUpdate().players).toEqual([player])
  })

  // The room page joins on mount, so a refresh or a reconnect must not seat
  // the same person twice.
  it('does not seat the same uid twice', async () => {
    await joinRoom('ABC234', room({ players: [player] }), player)
    expect(mocks.updateDoc).not.toHaveBeenCalled()
  })

  it('seats a signed-out visitor without a uid', async () => {
    await joinRoom('ABC234', room(), { uid: null, name: 'Guest', photoURL: null })
    expect(lastUpdate().players).toHaveLength(1)
  })

  // Two signed-out people at one table both have a null uid, so identity has
  // to fall back to the name rather than collapsing them into one seat.
  it('seats two different signed-out visitors separately', async () => {
    const seated = room({ players: [{ uid: null, name: 'Guest', photoURL: null }] })
    await joinRoom('ABC234', seated, { uid: null, name: 'Other', photoURL: null })
    expect(lastUpdate().players).toHaveLength(2)
  })
})

describe('restartRoom', () => {
  it('reshuffles and returns the pile to the start', async () => {
    await restartRoom('ABC234', 100)
    const update = lastUpdate()
    expect(update.drawn).toBe(0)
    expect(update.revealed).toBe(false)
    expect([...update.order].sort((a: number, b: number) => a - b)).toEqual(
      Array.from({ length: 100 }, (_, i) => i),
    )
  })
})

describe('endRoom', () => {
  it('marks the game ended and stamps the time', async () => {
    await endRoom('ABC234')
    expect(lastUpdate()).toMatchObject({ status: 'ended', endedAt: 'TS' })
  })
})

describe('fetchPlaybackUrls', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mocks.fetch)
  })

  it('returns an empty map without a network call when there is nothing to sign', async () => {
    const out = await fetchPlaybackUrls([])
    expect(out).toEqual({})
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  // The games are public, so a signed-out visitor must be able to hear the
  // answers. This request must never carry (or require) a Firebase token.
  it('signs keys without going through the authed client', async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        urls: [{ s3Key: 'public/cardgame/ABC234/a.webm', playbackUrl: 'https://signed/a' }],
      }),
    })
    const out = await fetchPlaybackUrls(['public/cardgame/ABC234/a.webm'])
    expect(out['public/cardgame/ABC234/a.webm']).toBe('https://signed/a')
    expect(mocks.apiPost).not.toHaveBeenCalled()
  })

  // A playback outage should cost the page its audio players, not its
  // transcripts and attribution.
  it('degrades to an empty map when the endpoint fails', async () => {
    mocks.fetch.mockResolvedValue({ ok: false, status: 500 })
    await expect(fetchPlaybackUrls(['public/cardgame/ABC234/a.webm'])).resolves.toEqual({})
  })
})
