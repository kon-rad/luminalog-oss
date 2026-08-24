import { describe, it, expect } from 'vitest'
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  generateRoomCode,
  normalizeRoomCode,
  shuffleOrder,
  currentCard,
  isExhausted,
  type Room,
} from './room'
import { BRIDGING_GENERATIONS } from './decks/bridgingGenerations'

/** Deterministic stand-in for Math.random: cycles through fixed values. */
function seeded(values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

function room(over: Partial<Room> = {}): Room {
  return {
    code: 'ABC234',
    deckId: 'bridging-generations',
    title: 'Test table',
    hostUid: 'uid-1',
    hostName: 'Host',
    status: 'active',
    order: [5, 9, 1],
    drawn: 0,
    revealed: false,
    players: [],
    answerCount: 0,
    ...over,
  }
}

describe('generateRoomCode', () => {
  it('produces a code of the declared length', () => {
    expect(generateRoomCode()).toHaveLength(ROOM_CODE_LENGTH)
  })

  it('draws only from the declared alphabet', () => {
    for (let i = 0; i < 200; i++) {
      for (const ch of generateRoomCode()) {
        expect(ROOM_CODE_ALPHABET).toContain(ch)
      }
    }
  })

  // A code gets read aloud across a noisy table and typed on a phone, so the
  // glyph pairs people confuse must not be in the alphabet at all.
  it('never emits an ambiguous glyph', () => {
    for (const ch of 'O0I1') {
      expect(ROOM_CODE_ALPHABET).not.toContain(ch)
    }
  })

  it('is deterministic for a given random source', () => {
    const a = generateRoomCode(seeded([0, 0.5, 0.99, 0.2, 0.4, 0.7]))
    const b = generateRoomCode(seeded([0, 0.5, 0.99, 0.2, 0.4, 0.7]))
    expect(a).toBe(b)
  })
})

describe('normalizeRoomCode', () => {
  it('uppercases and trims what a person typed', () => {
    expect(normalizeRoomCode('  abc234 ')).toBe('ABC234')
  })

  it('strips characters that are not in the alphabet', () => {
    expect(normalizeRoomCode('abc-234')).toBe('ABC234')
  })

  it('caps the length', () => {
    expect(normalizeRoomCode('ABC234EXTRA')).toHaveLength(ROOM_CODE_LENGTH)
  })
})

describe('shuffleOrder', () => {
  it('returns a permutation of every index', () => {
    const order = shuffleOrder(100)
    expect(order).toHaveLength(100)
    expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: 100 }, (_, i) => i))
  })

  it('is deterministic for a given random source', () => {
    const a = shuffleOrder(20, seeded([0.1, 0.9, 0.3, 0.7, 0.5]))
    const b = shuffleOrder(20, seeded([0.1, 0.9, 0.3, 0.7, 0.5]))
    expect(a).toEqual(b)
  })

  it('actually reorders', () => {
    const order = shuffleOrder(50, seeded([0.9, 0.1, 0.8, 0.2, 0.6]))
    expect(order).not.toEqual(Array.from({ length: 50 }, (_, i) => i))
  })
})

describe('currentCard', () => {
  it('is null before the first card is drawn', () => {
    expect(currentCard(room({ drawn: 0 }), BRIDGING_GENERATIONS)).toBeNull()
  })

  it('resolves the most recently drawn index through the shuffled order', () => {
    const card = currentCard(room({ drawn: 2 }), BRIDGING_GENERATIONS)
    expect(card).toBe(BRIDGING_GENERATIONS.cards[9])
  })

  it('is null when the order points past the end of the deck', () => {
    expect(currentCard(room({ order: [9999], drawn: 1 }), BRIDGING_GENERATIONS)).toBeNull()
  })
})

describe('isExhausted', () => {
  it('is false while cards remain', () => {
    expect(isExhausted(room({ drawn: 2 }))).toBe(false)
  })

  it('is true once every card has been drawn', () => {
    expect(isExhausted(room({ drawn: 3 }))).toBe(true)
  })
})
