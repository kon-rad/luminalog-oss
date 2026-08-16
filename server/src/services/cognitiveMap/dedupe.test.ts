import { describe, it, expect } from 'vitest'
import { cosine, collapseDuplicates } from './dedupe'
import type { CandidateBeat } from './types'

const beat = (id: string, over: Partial<CandidateBeat> = {}): CandidateBeat => ({
  id,
  kind: 'event',
  text: `beat ${id}`,
  quote: `beat ${id}`,
  quoteStart: 0,
  domain: 'craft',
  isSpine: false,
  generality: 0.2,
  mentions: [],
  ...over,
})

describe('cosine', () => {
  it('is 1 for identical vectors', () => {
    expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1)
  })

  it('is 0 for orthogonal vectors', () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0)
  })

  it('is 0 for a zero vector rather than NaN', () => {
    expect(cosine([0, 0], [1, 1])).toBe(0)
  })

  it('is 0 for mismatched lengths rather than throwing', () => {
    expect(cosine([1, 2], [1, 2, 3])).toBe(0)
  })
})

describe('collapseDuplicates', () => {
  it('keeps distinct beats', () => {
    const beats = [beat('b0'), beat('b1')]
    expect(collapseDuplicates(beats, [[1, 0], [0, 1]])).toHaveLength(2)
  })

  it('collapses a near-duplicate above the threshold', () => {
    const beats = [beat('b0'), beat('b1')]
    expect(collapseDuplicates(beats, [[1, 0], [0.999, 0.0447]])).toHaveLength(1)
  })

  it('keeps the member with the higher generality', () => {
    const beats = [beat('b0', { generality: 0.2 }), beat('b1', { generality: 0.9 })]
    expect(collapseDuplicates(beats, [[1, 0], [1, 0]])[0]!.generality).toBe(0.9)
  })

  it('preserves a spine flag from the discarded member', () => {
    const beats = [beat('b0', { generality: 0.9 }), beat('b1', { isSpine: true })]
    expect(collapseDuplicates(beats, [[1, 0], [1, 0]])[0]!.isSpine).toBe(true)
  })

  it('unions the mentions of collapsed members', () => {
    const beats = [
      beat('b0', { generality: 0.9, mentions: [{ surface: 'Anna', type: 'person' }] }),
      beat('b1', { mentions: [{ surface: 'the gym', type: 'place' }] }),
    ]
    const out = collapseDuplicates(beats, [[1, 0], [1, 0]])
    expect(out[0]!.mentions.map(m => m.surface).sort()).toEqual(['Anna', 'the gym'])
  })

  it('renumbers ids so they stay contiguous', () => {
    const beats = [beat('b0'), beat('b1'), beat('b2')]
    const out = collapseDuplicates(beats, [[1, 0], [1, 0], [0, 1]])
    expect(out.map(b => b.id)).toEqual(['b0', 'b1'])
  })

  it('is a no-op when the embeddings do not match the beats', () => {
    expect(collapseDuplicates([beat('b0'), beat('b1')], [])).toHaveLength(2)
  })
})
