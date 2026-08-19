import { describe, it, expect } from 'vitest'
import { parseEdges, formatBeatList } from './edges'
import type { CandidateBeat } from './types'

const ids = new Set(['b0', 'b1', 'b2'])
const raw = (edges: unknown) => JSON.stringify({ edges })
const edge = (over: Record<string, unknown> = {}) =>
  ({ from: 'b0', to: 'b1', type: 'caused', phrasing: 'drained', polarity: 1, ...over })

const beat = (id: string, text: string, kind: CandidateBeat['kind']): CandidateBeat => ({
  id, kind, text, quote: text, quoteStart: 0, domain: 'craft',
  isSpine: false, generality: 0.1, mentions: [],
})

describe('formatBeatList', () => {
  it('renders one line per beat as id, kind, text', () => {
    expect(formatBeatList([beat('b0', 'Only three signed up', 'event')]))
      .toBe('b0 | event | Only three signed up')
  })

  it('never includes the quote, so Pass B cannot see the raw entry', () => {
    const b = beat('b0', 'Short text', 'event')
    b.quote = 'A MUCH longer verbatim sentence from the entry.'
    expect(formatBeatList([b])).not.toContain('verbatim')
  })
})

describe('parseEdges', () => {
  it('parses a well-formed edge', () => {
    expect(parseEdges(raw([edge()]), ids)).toEqual([
      { from: 'b0', to: 'b1', type: 'caused', phrasing: 'drained', polarity: 1 },
    ])
  })

  it('accepts an empty edges array, which is a valid answer', () => {
    expect(parseEdges(raw([]), ids)).toEqual([])
  })

  it('returns an empty array when there is no JSON at all', () => {
    expect(parseEdges('no edges here', ids)).toEqual([])
  })

  it('discards an edge referencing an unknown id', () => {
    expect(parseEdges(raw([edge({ to: 'b99' })]), ids)).toEqual([])
  })

  it('discards a self-edge', () => {
    expect(parseEdges(raw([edge({ to: 'b0' })]), ids)).toEqual([])
  })

  it('discards an unknown edge type', () => {
    expect(parseEdges(raw([edge({ type: 'inspires' })]), ids)).toEqual([])
  })

  it('keeps only the first edge for a repeated pair', () => {
    const out = parseEdges(raw([edge({ phrasing: 'first' }), edge({ phrasing: 'second' })]), ids)
    expect(out).toHaveLength(1)
    expect(out[0]!.phrasing).toBe('first')
  })

  it('coerces an out-of-range polarity to 0', () => {
    expect(parseEdges(raw([edge({ polarity: 5 })]), ids)[0]!.polarity).toBe(0)
  })

  it('falls back to the edge type as phrasing when phrasing is missing', () => {
    expect(parseEdges(raw([edge({ phrasing: '', type: 'evidence_for' })]), ids)[0]!.phrasing)
      .toBe('evidence for')
  })

  it('truncates an over-long phrasing so it fits the edge plate', () => {
    const long = 'completely and utterly overwhelmed me in every possible way'
    expect(parseEdges(raw([edge({ phrasing: long })]), ids)[0]!.phrasing.length)
      .toBeLessThanOrEqual(18)
  })
})
