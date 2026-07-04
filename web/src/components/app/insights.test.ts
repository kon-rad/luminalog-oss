import { describe, it, expect } from 'vitest'
import {
  ACTIVITY_WINDOW_DAYS,
  EMOTION_MIN_ENTRIES,
  activityByDay,
  emotionSeries,
  hasEmotionData,
  typeCounts,
  wordFrequencies,
} from '@/components/app/insights'
import type { JournalEntry } from '@/lib/firestore/models'

const TZ = 'America/Los_Angeles'

// Minimal fixture builder — only the fields the pure helpers read.
function makeEntry(over: Partial<JournalEntry> & { emotion?: unknown } = {}): JournalEntry {
  return {
    id: over.id ?? crypto.randomUUID(),
    userId: 'u1',
    type: over.type ?? 'text',
    title: over.title ?? 'Untitled',
    content: over.content ?? '',
    createdAt: over.createdAt ?? new Date('2026-07-01T12:00:00-07:00'),
    updatedAt: over.updatedAt ?? new Date('2026-07-01T12:00:00-07:00'),
    media: over.media ?? [],
    vector: over.vector ?? { status: 'indexed', chunkCount: 1 },
    wordCount: over.wordCount ?? 0,
    excludeFromShare: over.excludeFromShare ?? false,
    ...(over.emotion !== undefined ? { emotion: over.emotion } : {}),
  } as JournalEntry
}

describe('wordFrequencies', () => {
  it('lowercases, strips punctuation, and counts frequency', () => {
    const result = wordFrequencies(['Hello, hello! World.', 'world? WORLD!!'])
    const hello = result.find((w) => w.word === 'hello')
    const world = result.find((w) => w.word === 'world')
    expect(hello?.count).toBe(2)
    expect(world?.count).toBe(3)
  })

  it('drops stopwords and tokens shorter than 3 chars', () => {
    const result = wordFrequencies(['the and a to of it is quiet morning walk'])
    const words = result.map((w) => w.word)
    expect(words).not.toContain('the')
    expect(words).not.toContain('and')
    expect(words).not.toContain('a')
    expect(words).not.toContain('to')
    expect(words).not.toContain('of')
    expect(words).not.toContain('it')
    expect(words).not.toContain('is')
    expect(words).toContain('quiet')
    expect(words).toContain('morning')
    expect(words).toContain('walk')
  })

  it('keeps intra-word apostrophes/hyphens but trims trailing punctuation', () => {
    const result = wordFrequencies(["I don't know about self-care. \"Quiet,\" she said."])
    const words = result.map((w) => w.word)
    expect(words).toContain("don't")
    expect(words).toContain('self-care')
    expect(words).toContain('quiet')
    expect(words).not.toContain('quiet,"')
  })

  it('drops pure-numeric tokens', () => {
    const result = wordFrequencies(['2026 was a wonderful 750 word morning'])
    const words = result.map((w) => w.word)
    expect(words).not.toContain('2026')
    expect(words).not.toContain('750')
    expect(words).toContain('wonderful')
  })

  it('sorts by count desc and respects the limit', () => {
    const result = wordFrequencies(['apple apple apple banana banana cherry'], 2)
    expect(result).toEqual([
      { word: 'apple', count: 3 },
      { word: 'banana', count: 2 },
    ])
  })

  it('returns [] for no words', () => {
    expect(wordFrequencies([''])).toEqual([])
    expect(wordFrequencies([])).toEqual([])
  })
})

describe('activityByDay', () => {
  it('returns a dense series of ACTIVITY_WINDOW_DAYS days, oldest first, ending today', () => {
    const now = new Date('2026-07-04T12:00:00-07:00')
    const series = activityByDay([], TZ, now)
    expect(series).toHaveLength(ACTIVITY_WINDOW_DAYS)
    expect(series[series.length - 1].day).toBe('2026-07-04')
    expect(series.every((d) => d.count === 0)).toBe(true)
  })

  it('counts entries per local day and fills missing days with 0', () => {
    const now = new Date('2026-07-04T12:00:00-07:00')
    const entries = [
      makeEntry({ createdAt: new Date('2026-07-04T10:00:00-07:00') }),
      makeEntry({ createdAt: new Date('2026-07-04T20:00:00-07:00') }),
      makeEntry({ createdAt: new Date('2026-07-02T09:00:00-07:00') }),
    ]
    const series = activityByDay(entries, TZ, now)
    const byDay = new Map(series.map((d) => [d.day, d.count]))
    expect(byDay.get('2026-07-04')).toBe(2)
    expect(byDay.get('2026-07-02')).toBe(1)
    expect(byDay.get('2026-07-03')).toBe(0)
  })

  it('buckets by the user timezone, not the browser/UTC day', () => {
    // 11PM June 9 in LA is already June 10 in UTC.
    const now = new Date('2026-06-10T12:00:00Z')
    const entry = makeEntry({ createdAt: new Date('2026-06-09T23:30:00-07:00') })
    const series = activityByDay([entry], TZ, now)
    const byDay = new Map(series.map((d) => [d.day, d.count]))
    expect(byDay.get('2026-06-09')).toBe(1)
  })
})

describe('typeCounts', () => {
  it('counts entries by type and omits zero-count types', () => {
    const entries = [
      makeEntry({ type: 'text' }),
      makeEntry({ type: 'text' }),
      makeEntry({ type: 'voice' }),
    ]
    expect(typeCounts(entries)).toEqual([
      { type: 'text', count: 2 },
      { type: 'voice', count: 1 },
    ])
  })

  it('returns [] for no entries', () => {
    expect(typeCounts([])).toEqual([])
  })

  it('returns entries in the fixed text/voice/video/image order regardless of input order', () => {
    const entries = [makeEntry({ type: 'image' }), makeEntry({ type: 'text' }), makeEntry({ type: 'video' })]
    expect(typeCounts(entries).map((t) => t.type)).toEqual(['text', 'video', 'image'])
  })
})

describe('hasEmotionData / emotionSeries', () => {
  it('is false/empty below EMOTION_MIN_ENTRIES', () => {
    const entries = Array.from({ length: EMOTION_MIN_ENTRIES - 1 }, () =>
      makeEntry({ emotion: { scores: { joy: 0.8 } } }),
    )
    expect(hasEmotionData(entries)).toBe(false)
    expect(emotionSeries(entries, TZ)).toEqual({ emotions: [], days: [] })
  })

  it('is true/populated at EMOTION_MIN_ENTRIES', () => {
    const entries = Array.from({ length: EMOTION_MIN_ENTRIES }, (_, i) =>
      makeEntry({
        createdAt: new Date(`2026-07-0${i + 1}T12:00:00-07:00`),
        emotion: { scores: { joy: 0.8 } },
      }),
    )
    expect(hasEmotionData(entries)).toBe(true)
    const series = emotionSeries(entries, TZ)
    expect(series.emotions).toEqual(['joy'])
    expect(series.days).toHaveLength(EMOTION_MIN_ENTRIES)
  })

  it('ignores entries with no emotion field, or an empty scores/top', () => {
    const entries = [
      makeEntry({}),
      makeEntry({ emotion: {} }),
      makeEntry({ emotion: { scores: {} } }),
      makeEntry({ emotion: { top: [] } }),
    ]
    expect(hasEmotionData(entries)).toBe(false)
  })

  it('falls back to top[] when scores{} is absent', () => {
    const entries = Array.from({ length: EMOTION_MIN_ENTRIES }, (_, i) =>
      makeEntry({
        createdAt: new Date(`2026-07-0${i + 1}T12:00:00-07:00`),
        emotion: { top: [{ name: 'calm', score: 0.5 }] },
      }),
    )
    const series = emotionSeries(entries, TZ)
    expect(series.emotions).toEqual(['calm'])
  })

  it('averages same-day, same-emotion scores and picks the top ~4 by total', () => {
    const day = '2026-07-01T09:00:00-07:00'
    const entries = [
      makeEntry({ createdAt: new Date(day), emotion: { scores: { joy: 0.2, calm: 0.9 } } }),
      makeEntry({ createdAt: new Date(day), emotion: { scores: { joy: 0.8 } } }),
      makeEntry({
        createdAt: new Date('2026-07-02T09:00:00-07:00'),
        emotion: { scores: { sadness: 0.1, anger: 0.1, fear: 0.1, surprise: 0.1 } },
      }),
    ]
    const series = emotionSeries(entries, TZ)
    // joy total = 1.0 (highest), calm total = 0.9 -> both should make the top-4
    // ahead of the four low-scoring emotions from the second entry.
    expect(series.emotions.slice(0, 2)).toEqual(['joy', 'calm'])
    expect(series.emotions).toHaveLength(4)

    const day1 = series.days.find((d) => d.day === '2026-07-01')
    expect(day1?.values.joy).toBeCloseTo(0.5) // (0.2 + 0.8) / 2
    expect(day1?.values.calm).toBeCloseTo(0.9)
  })

  it('sorts days ascending', () => {
    const entries = [
      makeEntry({ createdAt: new Date('2026-07-03T09:00:00-07:00'), emotion: { scores: { joy: 0.5 } } }),
      makeEntry({ createdAt: new Date('2026-07-01T09:00:00-07:00'), emotion: { scores: { joy: 0.5 } } }),
      makeEntry({ createdAt: new Date('2026-07-02T09:00:00-07:00'), emotion: { scores: { joy: 0.5 } } }),
    ]
    const series = emotionSeries(entries, TZ)
    expect(series.days.map((d) => d.day)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03'])
  })
})
