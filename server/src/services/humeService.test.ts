import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('../config', () => ({ config: { HUME_API_KEY: 'k' } }))

import { normalizeEmotions, topN } from './humeService'

describe('normalizeEmotions', () => {
  it('digs emotions arrays out of nested Hume predictions and averages by name', () => {
    const predictions = [{
      results: { predictions: [{ models: { language: { grouped_predictions: [
        { predictions: [
          { emotions: [{ name: 'Joy', score: 0.8 }, { name: 'Calmness', score: 0.4 }] },
          { emotions: [{ name: 'Joy', score: 0.6 }, { name: 'Calmness', score: 0.6 }] },
        ] },
      ] } } }] },
    }]
    const scores = normalizeEmotions(predictions)
    expect(scores.Joy).toBeCloseTo(0.7)
    expect(scores.Calmness).toBeCloseTo(0.5)
  })

  it('returns empty object for empty/garbage input', () => {
    expect(normalizeEmotions([])).toEqual({})
    expect(normalizeEmotions([{ nope: 1 }] as any)).toEqual({})
  })
})

describe('topN', () => {
  it('returns the highest-scoring emotions, sorted desc, capped', () => {
    const top = topN({ Joy: 0.2, Calm: 0.9, Fear: 0.5 }, 2)
    expect(top).toEqual([{ name: 'Calm', score: 0.9 }, { name: 'Fear', score: 0.5 }])
  })
})
