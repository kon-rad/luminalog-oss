import { describe, it, expect, beforeAll } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import {
  decodeEntry,
  decodeStats,
  encodeStats,
  encodeTextEntryCreate,
  type TextEntryCreateInput,
} from '@/lib/firestore/codec'
import type { Stats } from '@/lib/firestore/models'

let key: CryptoKey

beforeAll(async () => {
  key = await crypto.subtle.importKey('raw', new Uint8Array(32), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ])
})

describe('text entry create → decode round-trip', () => {
  const input: TextEntryCreateInput = {
    userId: 'user-123',
    title: 'A quiet morning',
    content: 'Today I wrote about the fog rolling in over the hills. 🌫️',
    createdAt: new Date('2026-06-10T15:04:05.000Z'),
    updatedAt: new Date('2026-06-10T15:04:06.000Z'),
    wordCount: 11,
  }

  it('encodes the exact create map (design §6)', async () => {
    const map = await encodeTextEntryCreate(input, key)
    expect(map.userId).toBe('user-123')
    expect(map.type).toBe('text')
    expect(map.media).toEqual([])
    expect(map.vector).toEqual({ status: 'pending', chunkCount: 0 })
    expect(map.wordCount).toBe(11)
    expect(map.excludeFromShare).toBe(false)
    expect(map.createdAt).toBeInstanceOf(Timestamp)
    expect(map.updatedAt).toBeInstanceOf(Timestamp)
    // title/content are envelopes, not plaintext.
    expect(map.title).not.toBe(input.title)
    expect((map.title as { alg?: string }).alg).toBe('A256GCM')
    expect('promptText' in map).toBe(false) // omitted when not provided
  })

  it('decodes back to the original plaintext + fields', async () => {
    const map = await encodeTextEntryCreate(input, key)
    const entry = await decodeEntry('entry-1', map, key)
    expect(entry).not.toBeNull()
    expect(entry!.id).toBe('entry-1')
    expect(entry!.title).toBe(input.title)
    expect(entry!.content).toBe(input.content)
    expect(entry!.type).toBe('text')
    expect(entry!.wordCount).toBe(11)
    expect(entry!.excludeFromShare).toBe(false)
    expect(entry!.vector).toEqual({ status: 'pending', chunkCount: 0, indexedAt: undefined })
    expect(entry!.createdAt.getTime()).toBe(input.createdAt.getTime())
    expect(entry!.updatedAt.getTime()).toBe(input.updatedAt.getTime())
    expect(entry!.media).toEqual([])
  })

  it('carries promptText through when provided', async () => {
    const map = await encodeTextEntryCreate({ ...input, promptText: 'What made you smile?' }, key)
    expect(map.promptText).toBe('What made you smile?')
    const entry = await decodeEntry('entry-2', map, key)
    expect(entry!.promptText).toBe('What made you smile?')
  })
})

describe('decodeEntry fail-closed', () => {
  it('returns null when a required field is corrupted', async () => {
    const map = await encodeTextEntryCreate(
      {
        userId: 'u',
        title: 'ok',
        content: 'ok',
        createdAt: new Date(),
        updatedAt: new Date(),
        wordCount: 1,
      },
      key,
    )
    // Corrupt the required title into a non-envelope value.
    map.title = 'not-an-envelope'
    const entry = await decodeEntry('bad-1', map, key)
    expect(entry).toBeNull()
  })

  it('returns null for an unknown type', async () => {
    const map = await encodeTextEntryCreate(
      {
        userId: 'u',
        title: 'ok',
        content: 'ok',
        createdAt: new Date(),
        updatedAt: new Date(),
        wordCount: 1,
      },
      key,
    )
    map.type = 'quantum'
    expect(await decodeEntry('bad-2', map, key)).toBeNull()
  })
})

describe('decodeEntry emotion (plaintext)', () => {
  const base = {
    userId: 'u',
    title: 'ok',
    content: 'ok',
    createdAt: new Date(),
    updatedAt: new Date(),
    wordCount: 1,
  }

  it('maps a well-formed emotion object (scores + top)', async () => {
    const map = await encodeTextEntryCreate(base, key)
    map.emotion = {
      source: 'prosody',
      scores: { joy: 0.8, calm: 0.4 },
      top: [{ name: 'joy', score: 0.8 }],
      model: 'hume',
    }
    const entry = await decodeEntry('emo-1', map, key)
    expect(entry!.emotion).toEqual({
      source: 'prosody',
      scores: { joy: 0.8, calm: 0.4 },
      top: [{ name: 'joy', score: 0.8 }],
      model: 'hume',
    })
  })

  it('omits emotion when absent or carrying no usable score data', async () => {
    const noField = await decodeEntry('emo-2', await encodeTextEntryCreate(base, key), key)
    expect(noField!.emotion).toBeUndefined()

    const emptyMap = await encodeTextEntryCreate(base, key)
    emptyMap.emotion = { source: 'prosody', model: 'hume' } // no scores/top
    const empty = await decodeEntry('emo-3', emptyMap, key)
    expect(empty!.emotion).toBeUndefined()
  })
})

describe('encodeStats wire format', () => {
  const base: Stats = {
    streakCount: 4,
    maxStreakCount: 9,
    totalWords: 1234,
    goalDayWords: 800,
    promptsAnswered: 3,
  }

  it('omits lastEntryDate / goalDayDate when unset', () => {
    const wire = encodeStats(base)
    expect(wire).toEqual({
      streakCount: 4,
      maxStreakCount: 9,
      totalWords: 1234,
      goalDayWords: 800,
      promptsAnswered: 3,
    })
    expect('lastEntryDate' in wire).toBe(false)
    expect('goalDayDate' in wire).toBe(false)
  })

  it('includes lastEntryDate / goalDayDate as Timestamps when set', () => {
    const d1 = new Date('2026-06-10T00:00:00Z')
    const d2 = new Date('2026-06-09T00:00:00Z')
    const wire = encodeStats({ ...base, lastEntryDate: d1, goalDayDate: d2 })
    expect(wire.lastEntryDate).toBeInstanceOf(Timestamp)
    expect(wire.goalDayDate).toBeInstanceOf(Timestamp)
    // round-trips through decodeStats
    const back = decodeStats(wire)
    expect(back.lastEntryDate!.getTime()).toBe(d1.getTime())
    expect(back.goalDayDate!.getTime()).toBe(d2.getTime())
    expect(back.streakCount).toBe(4)
    expect(back.maxStreakCount).toBe(9)
  })

  it('decodeStats defaults missing fields to 0 / undefined', () => {
    const s = decodeStats({})
    expect(s.streakCount).toBe(0)
    expect(s.lastEntryDate).toBeUndefined()
    expect(s.goalDayDate).toBeUndefined()
  })
})
