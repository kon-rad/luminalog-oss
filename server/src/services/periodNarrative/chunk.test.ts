import { describe, it, expect } from 'vitest'
import { chunkDays, MAX_BEATS_PER_CHUNK, type PeriodNarrativeDayInput } from './chunk'

function dayWith(dayIndex: number, beatCount: number): PeriodNarrativeDayInput {
  return {
    dayIndex,
    beats: Array.from({ length: beatCount }, (_, i) => ({
      text: `beat ${dayIndex}-${i}`, kind: 'event', domain: 'craft', isSpine: false,
    })),
  }
}

describe('chunkDays', () => {
  it('returns an empty array for empty input', () => {
    expect(chunkDays([])).toEqual([])
  })

  it('drops days with no beats', () => {
    const days = [dayWith(1, 0), dayWith(2, 3)]
    const chunks = chunkDays(days)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.map(d => d.dayIndex)).toEqual([2])
  })

  it('keeps everything in one chunk when comfortably under the threshold', () => {
    const days = [dayWith(1, 5), dayWith(2, 5), dayWith(3, 5)]
    const chunks = chunkDays(days, 100)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.map(d => d.dayIndex)).toEqual([1, 2, 3])
  })

  it('splits into multiple chunks once the threshold is exceeded, never splitting a day', () => {
    const days = [dayWith(1, 3), dayWith(2, 3), dayWith(3, 3)]
    const chunks = chunkDays(days, 5)
    // day 1 (3) fits alone; day 2 (3) would push chunk 1 to 6 > 5, so it starts chunk 2;
    // day 3 (3) would push chunk 2 to 6 > 5, so it starts chunk 3.
    expect(chunks.map(c => c.map(d => d.dayIndex))).toEqual([[1], [2], [3]])
    for (const chunk of chunks) {
      const total = chunk.reduce((sum, d) => sum + d.beats.length, 0)
      expect(total).toBeLessThanOrEqual(5)
    }
  })

  it('gives an oversized single day its own chunk rather than looping forever', () => {
    const days = [dayWith(1, 20)]
    const chunks = chunkDays(days, 5)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.map(d => d.dayIndex)).toEqual([1])
  })

  it('sorts by dayIndex ascending regardless of input order', () => {
    const days = [dayWith(3, 2), dayWith(1, 2), dayWith(2, 2)]
    const chunks = chunkDays(days, 100)
    expect(chunks[0]!.map(d => d.dayIndex)).toEqual([1, 2, 3])
  })

  it('defaults to MAX_BEATS_PER_CHUNK when no threshold is given', () => {
    const days = [dayWith(1, MAX_BEATS_PER_CHUNK + 1)]
    const chunks = chunkDays(days)
    expect(chunks).toHaveLength(1)
  })
})
