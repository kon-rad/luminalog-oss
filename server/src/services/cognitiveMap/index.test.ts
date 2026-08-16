import { describe, it, expect, vi, beforeEach } from 'vitest'

const chatCompletion = vi.fn()
const embed = vi.fn()
const chatModelChain = vi.fn(() => ['model-a', 'model-b'])

vi.mock('../aiClient', () => ({
  chatCompletion: (...args: unknown[]) => chatCompletion(...args),
  embed: (...args: unknown[]) => embed(...args),
  chatModelChain: () => chatModelChain(),
}))

import { generateEntryMap } from './index'

const ENTRY =
  "Only three people signed up for the beta today. I'm scared the product just isn't good enough."

const ok = (content: string) => ({
  ok: true,
  json: async () => ({ choices: [{ message: { content } }] }),
})

const passA = JSON.stringify({
  beats: [
    {
      text: 'Only three people signed up', kind: 'event',
      quote: 'Only three people signed up for the beta today.',
      domain: 'craft', generality: 0.1, isSpine: true,
      mentions: [{ surface: 'the beta', type: 'project' }],
    },
    {
      text: "Scared the product isn't good", kind: 'feeling',
      quote: "I'm scared the product just isn't good enough.",
      domain: 'mind', generality: 0.35, isSpine: true, mentions: [],
    },
  ],
})

const passB = JSON.stringify({
  edges: [{ from: 'b0', to: 'b1', type: 'caused', phrasing: 'drained', polarity: 1 }],
})

beforeEach(() => {
  vi.clearAllMocks()
  chatModelChain.mockReturnValue(['model-a', 'model-b'])
  embed.mockResolvedValue([[1, 0], [0, 1]])
})

describe('generateEntryMap', () => {
  it('returns a valid map from two successful passes', async () => {
    chatCompletion.mockResolvedValueOnce(ok(passA)).mockResolvedValueOnce(ok(passB))
    const map = await generateEntryMap({ content: ENTRY })
    expect(map.v).toBe(1)
    expect(map.beats).toHaveLength(2)
    expect(map.edges).toHaveLength(1)
    expect(map.model).toBe('model-a')
    expect(map.generatedAt).toBeTruthy()
  })

  it('never emits a quote that is not in the entry', async () => {
    chatCompletion.mockResolvedValueOnce(ok(passA)).mockResolvedValueOnce(ok(passB))
    const map = await generateEntryMap({ content: ENTRY })
    for (const beat of map.beats) expect(ENTRY).toContain(beat.quote)
  })

  it('records a quoteStart that actually locates the quote', async () => {
    chatCompletion.mockResolvedValueOnce(ok(passA)).mockResolvedValueOnce(ok(passB))
    const map = await generateEntryMap({ content: ENTRY })
    for (const beat of map.beats) {
      expect(ENTRY.slice(beat.quoteStart, beat.quoteStart + beat.quote.length)).toBe(beat.quote)
    }
  })

  it('retries Pass A once when a quote fails verification', async () => {
    const bad = JSON.stringify({
      beats: [{
        text: 'Paraphrased', kind: 'event', quote: 'not in the entry at all',
        domain: 'craft', generality: 0.1, isSpine: false, mentions: [],
      }],
    })
    chatCompletion
      .mockResolvedValueOnce(ok(bad))     // Pass A, all quotes fail
      .mockResolvedValueOnce(ok(passA))   // repair pass, quotes good
      .mockResolvedValueOnce(ok(passB))   // Pass B
    const map = await generateEntryMap({ content: ENTRY })
    expect(map.beats).toHaveLength(2)
  })

  it('advances to the next model when the first returns unparseable output', async () => {
    chatCompletion
      .mockResolvedValueOnce(ok('I cannot do that'))
      .mockResolvedValueOnce(ok(passA))
      .mockResolvedValueOnce(ok(passB))
    const map = await generateEntryMap({ content: ENTRY })
    expect(map.model).toBe('model-b')
  })

  it('advances to the next model when the first call is not ok', async () => {
    chatCompletion
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce(ok(passA))
      .mockResolvedValueOnce(ok(passB))
    const map = await generateEntryMap({ content: ENTRY })
    expect(map.model).toBe('model-b')
  })

  it('throws only when every model in the chain fails', async () => {
    chatCompletion.mockResolvedValue(ok('nothing usable'))
    await expect(generateEntryMap({ content: ENTRY })).rejects.toThrow()
  })

  it('still returns a map when Pass B fails entirely', async () => {
    chatCompletion
      .mockResolvedValueOnce(ok(passA))
      .mockRejectedValueOnce(new Error('edges down'))
    const map = await generateEntryMap({ content: ENTRY })
    expect(map.beats.length).toBeGreaterThan(0)
    expect(map.edges).toEqual([])
  })

  it('still returns a map when the embedding call fails', async () => {
    embed.mockRejectedValue(new Error('embeddings down'))
    chatCompletion.mockResolvedValueOnce(ok(passA)).mockResolvedValueOnce(ok(passB))
    const map = await generateEntryMap({ content: ENTRY })
    expect(map.beats).toHaveLength(2)
  })

  it('sends the raw entry to Pass A but only the beat list to Pass B', async () => {
    chatCompletion.mockResolvedValueOnce(ok(passA)).mockResolvedValueOnce(ok(passB))
    await generateEntryMap({ content: ENTRY })
    const passAMessages = chatCompletion.mock.calls[0]![0] as Array<{ content: string }>
    const passBMessages = chatCompletion.mock.calls[1]![0] as Array<{ content: string }>
    expect(passAMessages[1]!.content).toBe(ENTRY)
    expect(passBMessages[1]!.content)
      .not.toContain('Only three people signed up for the beta today.')
    expect(passBMessages[1]!.content).toContain('b0 | event |')
  })

  it('requests JSON mode on both passes', async () => {
    chatCompletion.mockResolvedValueOnce(ok(passA)).mockResolvedValueOnce(ok(passB))
    await generateEntryMap({ content: ENTRY })
    for (const call of chatCompletion.mock.calls) {
      expect((call[1] as { response_format?: unknown }).response_format)
        .toEqual({ type: 'json_object' })
    }
  })

  it('never emits an edge whose endpoints are not in the beat list', async () => {
    chatCompletion.mockResolvedValueOnce(ok(passA)).mockResolvedValueOnce(ok(passB))
    const map = await generateEntryMap({ content: ENTRY })
    const ids = new Set(map.beats.map(b => b.id))
    for (const e of map.edges) {
      expect(ids.has(e.from)).toBe(true)
      expect(ids.has(e.to)).toBe(true)
    }
  })
})
