import { describe, it, expect } from 'vitest'
import { parseCandidates, verifyQuotes, targetCandidateCount, type RawCandidate } from './extract'

const ENTRY =
  "Only three people signed up for the beta today. I'm scared the product just isn't good enough."

const raw = (beats: unknown) => JSON.stringify({ beats })

const candidate = (over: Record<string, unknown> = {}): RawCandidate => ({
  text: 'Only three people signed up',
  kind: 'event',
  quote: 'Only three people signed up for the beta today.',
  domain: 'craft',
  generality: 0.1,
  isSpine: true,
  mentions: [{ surface: 'the beta', type: 'project' }],
  ...over,
} as RawCandidate)

describe('parseCandidates', () => {
  it('parses a well-formed response', () => {
    const out = parseCandidates(raw([candidate()]))!
    expect(out).toHaveLength(1)
    expect(out[0]!.kind).toBe('event')
    expect(out[0]!.mentions).toEqual([{ surface: 'the beta', type: 'project' }])
  })

  it('tolerates markdown fences and surrounding prose', () => {
    const wrapped = 'Sure! Here you go:\n```json\n' + raw([candidate()]) + '\n```\nHope that helps.'
    expect(parseCandidates(wrapped)).toHaveLength(1)
  })

  it('returns null when there is no JSON object', () => {
    expect(parseCandidates('I cannot help with that.')).toBeNull()
  })

  it('returns null when the beats array is empty', () => {
    expect(parseCandidates(raw([]))).toBeNull()
  })

  it('drops a beat with an unknown kind rather than failing the whole parse', () => {
    const out = parseCandidates(raw([candidate(), candidate({ kind: 'wish' })]))!
    expect(out).toHaveLength(1)
  })

  it('coerces an unknown domain to "other"', () => {
    expect(parseCandidates(raw([candidate({ domain: 'spirituality' })]))![0]!.domain).toBe('other')
  })

  it('clamps generality into 0 to 1', () => {
    expect(parseCandidates(raw([candidate({ generality: 7 })]))![0]!.generality).toBe(1)
    expect(parseCandidates(raw([candidate({ generality: -3 })]))![0]!.generality).toBe(0)
  })

  it('defaults a missing generality to 0', () => {
    expect(parseCandidates(raw([candidate({ generality: undefined })]))![0]!.generality).toBe(0)
  })

  it('drops mentions with an unknown type but keeps the beat', () => {
    const out = parseCandidates(raw([candidate({ mentions: [{ surface: 'x', type: 'deity' }] })]))!
    expect(out[0]!.mentions).toEqual([])
  })

  it('drops a beat with an empty text or quote', () => {
    expect(parseCandidates(raw([candidate({ text: '   ' })]))).toBeNull()
    expect(parseCandidates(raw([candidate({ quote: '' })]))).toBeNull()
  })
})

describe('verifyQuotes', () => {
  it('accepts an exact substring and records its offset', () => {
    const { verified, failed } = verifyQuotes([candidate()], ENTRY)
    expect(failed).toEqual([])
    expect(verified[0]!.quoteStart).toBe(0)
    expect(
      ENTRY.slice(verified[0]!.quoteStart, verified[0]!.quoteStart + verified[0]!.quote.length),
    ).toBe(verified[0]!.quote)
  })

  it('records the offset of a quote that is not at the start', () => {
    const beat = candidate({ quote: "I'm scared the product just isn't good enough." })
    const { verified } = verifyQuotes([beat], ENTRY)
    expect(verified[0]!.quoteStart).toBe(ENTRY.indexOf("I'm scared"))
  })

  it('rejects a paraphrased quote', () => {
    const beat = candidate({ quote: 'Only three signed up for the beta.' })
    const { verified, failed } = verifyQuotes([beat], ENTRY)
    expect(verified).toHaveLength(0)
    expect(failed).toEqual(['Only three signed up for the beta.'])
  })

  it('assigns sequential ids to the verified beats', () => {
    const beats = [
      candidate(),
      candidate({ quote: "I'm scared the product just isn't good enough." }),
    ]
    const { verified } = verifyQuotes(beats, ENTRY)
    expect(verified.map(b => b.id)).toEqual(['b0', 'b1'])
  })

  it('renumbers after a rejection so ids stay contiguous', () => {
    const beats = [candidate({ quote: 'not in the entry' }), candidate()]
    const { verified } = verifyQuotes(beats, ENTRY)
    expect(verified.map(b => b.id)).toEqual(['b0'])
  })
})

describe('targetCandidateCount', () => {
  it('asks for fewer beats from a very short entry', () => {
    expect(targetCandidateCount('Tired today.')).toBeLessThan(10)
  })

  it('asks for about twenty from a normal-length entry', () => {
    expect(targetCandidateCount('word '.repeat(600))).toBe(20)
  })

  it('never asks for fewer than three', () => {
    expect(targetCandidateCount('.')).toBeGreaterThanOrEqual(3)
  })
})
