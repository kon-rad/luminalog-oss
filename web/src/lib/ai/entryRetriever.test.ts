import { describe, it, expect } from 'vitest'
import { topKByKeyword, type RetrievableEntry } from '@/lib/ai/entryRetriever'

const now = new Date('2026-07-10T00:00:00Z')
const E = (id: string, title: string, content: string, days: number): RetrievableEntry => ({
  id,
  title,
  content,
  createdAt: new Date(now.getTime() - days * 86_400_000),
})

describe('topKByKeyword', () => {
  it('weights a title match (3.0) above a content match (1.0)', () => {
    const entries = [E('a', 'ocean waves', 'nothing', 1), E('b', 'nothing', 'ocean today', 1)]
    const out = topKByKeyword(2, 'ocean', entries, now)
    expect(out.map((r) => r.entry.id)).toEqual(['a', 'b'])
    expect(out[0].score).toBeGreaterThan(out[1].score)
  })

  it('empty query returns the most-recent K', () => {
    const entries = [E('old', 't', 'c', 10), E('new', 't', 'c', 1)]
    expect(topKByKeyword(1, '', entries, now)[0].entry.id).toBe('new')
  })

  it('is case- and diacritic-insensitive', () => {
    const entries = [E('a', 'Café Notes', 'x', 1), E('b', 'unrelated', 'y', 1)]
    expect(topKByKeyword(1, 'cafe', entries, now)[0].entry.id).toBe('a')
  })

  it('recency only breaks ties (equal keyword score → newer first)', () => {
    const entries = [E('older', 'ocean', 'x', 5), E('newer', 'ocean', 'y', 1)]
    expect(topKByKeyword(2, 'ocean', entries, now).map((r) => r.entry.id)).toEqual(['newer', 'older'])
  })

  it('counts each distinct term once (coverage, not frequency)', () => {
    const entries = [E('a', 'sea sea sea', 'sea', 1), E('b', 'sea calm', 'sea calm', 1)]
    // 'b' covers both 'sea' and 'calm' in the title → higher than 'a' repeating 'sea'.
    expect(topKByKeyword(2, 'sea calm', entries, now).map((r) => r.entry.id)).toEqual(['b', 'a'])
  })
})
