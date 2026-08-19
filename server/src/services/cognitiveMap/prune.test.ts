import { describe, it, expect } from 'vitest'
import { buildBeats } from './prune'
import type { CandidateBeat, Edge } from './types'

const candidate = (id: string, over: Partial<CandidateBeat> = {}): CandidateBeat => ({
  id,
  kind: 'event',
  text: `beat ${id}`,
  quote: `beat ${id}`,
  quoteStart: 0,
  domain: 'craft',
  isSpine: false,
  generality: 0.1,
  mentions: [],
  ...over,
})

const edge = (from: string, to: string): Edge =>
  ({ from, to, type: 'caused', phrasing: 'led to', polarity: 1 })

describe('buildBeats', () => {
  it('counts degree from both incoming and outgoing edges', () => {
    const beats = buildBeats([candidate('b0'), candidate('b1')], [edge('b0', 'b1')])
    expect(beats.find(b => b.id === 'b0')!.degree).toBe(1)
    expect(beats.find(b => b.id === 'b1')!.degree).toBe(1)
  })

  it('promotes a connected beat to the map tier', () => {
    const beats = buildBeats([candidate('b0'), candidate('b1')], [edge('b0', 'b1')])
    expect(beats.every(b => b.tier === 'map')).toBe(true)
  })

  it('leaves an unconnected, ungeneral, unmentioned, non-spine beat in the ledger', () => {
    const beats = buildBeats(
      [candidate('b0'), candidate('b1'), candidate('b2')], [edge('b0', 'b1')],
    )
    expect(beats.find(b => b.id === 'b2')!.tier).toBe('ledger')
  })

  it('promotes an unconnected beat with high generality', () => {
    expect(buildBeats([candidate('b0', { generality: 0.7 })], [])[0]!.tier).toBe('map')
  })

  it('promotes an unconnected beat that carries an entity mention', () => {
    const beats = buildBeats(
      [candidate('b0', { mentions: [{ surface: 'Anna', type: 'person' }] })], [],
    )
    expect(beats[0]!.tier).toBe('map')
  })

  it('promotes a spine beat even with nothing else going for it', () => {
    expect(buildBeats([candidate('b0', { isSpine: true })], [])[0]!.tier).toBe('map')
  })

  it('caps the map tier at 9, keeping the highest keepScore', () => {
    const many = Array.from({ length: 14 }, (_, i) =>
      candidate(`b${i}`, { generality: 0.7 + i * 0.02 }))
    const drawn = buildBeats(many, []).filter(b => b.tier === 'map')
    expect(drawn).toHaveLength(9)
    // The lowest-scoring candidates are the ones that fell to the ledger.
    expect(drawn.map(b => b.id)).not.toContain('b0')
  })

  it('always draws at least one beat, even when nothing qualifies', () => {
    const beats = buildBeats([candidate('b0'), candidate('b1')], [])
    expect(beats.filter(b => b.tier === 'map')).toHaveLength(1)
  })

  it('never prunes away every spine beat', () => {
    const many = Array.from({ length: 14 }, (_, i) =>
      candidate(`b${i}`, { generality: 0.9, isSpine: i === 13 }))
    const beats = buildBeats(many, [])
    expect(beats.filter(b => b.isSpine && b.tier === 'map').length).toBeGreaterThanOrEqual(1)
  })

  it('marks a general, connected, realization-marked beat as a keeper', () => {
    const beats = buildBeats(
      [
        candidate('b0', { generality: 0.9, quote: 'I realized I avoid hard things.' }),
        candidate('b1'),
      ],
      [edge('b1', 'b0')],
    )
    expect(beats.find(b => b.id === 'b0')!.isKeeper).toBe(true)
  })

  it('does NOT make an isolated beat a keeper, however general', () => {
    // A beat that nothing caused and that caused nothing did not matter. Generality
    // and a realization marker alone score 0.576, under the 0.62 floor, on purpose.
    const beats = buildBeats(
      [candidate('b0', { generality: 0.9, quote: 'I realized I avoid hard things.' })], [],
    )
    expect(beats[0]!.isKeeper).toBe(false)
  })

  it('never marks a beat below the generality floor as a keeper', () => {
    const beats = buildBeats(
      [candidate('b0', { generality: 0.5, quote: 'I realized this.', isSpine: true })], [],
    )
    expect(beats[0]!.isKeeper).toBe(false)
  })

  it('caps keepers at 2 per entry', () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      candidate(`b${i}`, { generality: 0.95, quote: 'I realized something important.' }))
    // Chain them so every beat is connected and therefore keeper-eligible.
    const chain = many.slice(1).map((_, i) => edge(`b${i}`, `b${i + 1}`))
    expect(buildBeats(many, chain).filter(b => b.isKeeper)).toHaveLength(2)
  })

  it('allows zero keepers, which is the common case', () => {
    const beats = buildBeats([candidate('b0'), candidate('b1')], [edge('b0', 'b1')])
    expect(beats.filter(b => b.isKeeper)).toHaveLength(0)
  })

  it('carries every candidate through, ledger beats included', () => {
    expect(buildBeats([candidate('b0'), candidate('b1'), candidate('b2')], [])).toHaveLength(3)
  })

  it('never marks a ledger beat as a keeper', () => {
    const many = Array.from({ length: 14 }, (_, i) =>
      candidate(`b${i}`, { generality: 0.95, quote: 'I realized something.' }))
    const beats = buildBeats(many, [])
    expect(beats.filter(b => b.isKeeper && b.tier === 'ledger')).toHaveLength(0)
  })
})
