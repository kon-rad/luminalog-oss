import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { JournalEntry } from '@/lib/firestore/models'

const apiPost = vi.fn()
const updateCognitiveMap = vi.fn()

vi.mock('@/lib/api/client', () => ({ apiPost: (...a: unknown[]) => apiPost(...a) }))
vi.mock('@/lib/firestore/journals', () => ({
  updateCognitiveMap: (...a: unknown[]) => updateCognitiveMap(...a),
}))

const { ensureCognitiveMap } = await import('./entryMap')

const response = {
  v: 1,
  beats: [{
    id: 'b0', tier: 'map', kind: 'event', text: 'Signed up', quote: 'Signed up.',
    quoteStart: 0, domain: 'craft', isSpine: true, isKeeper: false,
    generality: 0.1, keepScore: 0.2, degree: 0, mentions: [],
  }],
  edges: [],
  model: 'llama-3.3-70b',
  generatedAt: '2026-08-16T10:00:00.000Z',
}

const entry = (over: Partial<JournalEntry> = {}): JournalEntry =>
  ({ id: 'e1', type: 'text', content: 'Signed up.', ...over }) as JournalEntry

beforeEach(() => {
  // resetAllMocks, not clearAllMocks: clear wipes recorded calls but LEAVES the
  // implementation, so a mockRejectedValue set in one test leaks into the next.
  vi.resetAllMocks()
  apiPost.mockResolvedValue(response)
  updateCognitiveMap.mockResolvedValue(undefined)
})

describe('ensureCognitiveMap', () => {
  it('posts the plaintext content and persists the map', async () => {
    expect(await ensureCognitiveMap(entry())).toBe(true)
    expect(apiPost).toHaveBeenCalledWith('/v1/ai/entry-map', {
      content: 'Signed up.', type: 'text',
    })
    expect(updateCognitiveMap).toHaveBeenCalledWith('e1', expect.objectContaining({
      model: 'llama-3.3-70b',
      version: 1,
    }))
  })

  it('skips an entry that already has a fresh map', async () => {
    const fresh = entry({
      cognitiveMap: {
        map: { v: 1, beats: [], edges: [] }, generatedAt: new Date(), model: 'm', version: 1,
      },
    })
    expect(await ensureCognitiveMap(fresh)).toBe(false)
    expect(apiPost).not.toHaveBeenCalled()
  })

  it('skips an empty entry', async () => {
    expect(await ensureCognitiveMap(entry({ content: '   ' }))).toBe(false)
    expect(apiPost).not.toHaveBeenCalled()
  })

  it('de-dupes concurrent calls for the same entry', async () => {
    const [a, b] = await Promise.all([
      ensureCognitiveMap(entry()),
      ensureCognitiveMap(entry()),
    ])
    expect(apiPost).toHaveBeenCalledTimes(1)
    expect([a, b].filter(Boolean)).toHaveLength(1)
  })

  it('returns false and persists nothing when the endpoint fails', async () => {
    apiPost.mockRejectedValue(new Error('502'))
    expect(await ensureCognitiveMap(entry())).toBe(false)
    expect(updateCognitiveMap).not.toHaveBeenCalled()
  })

  it('returns false when the response is not a structurally valid map', async () => {
    apiPost.mockResolvedValue({ v: 1, beats: 'nope', edges: [] })
    expect(await ensureCognitiveMap(entry())).toBe(false)
    expect(updateCognitiveMap).not.toHaveBeenCalled()
  })

  it('rejects a response whose edge points at a missing beat', async () => {
    apiPost.mockResolvedValue({
      ...response,
      edges: [{ from: 'b0', to: 'bZZ', type: 'caused', phrasing: 'x', polarity: 0 }],
    })
    expect(await ensureCognitiveMap(entry())).toBe(false)
    expect(updateCognitiveMap).not.toHaveBeenCalled()
  })

  it('returns false when the persist itself fails', async () => {
    updateCognitiveMap.mockRejectedValue(new Error('offline'))
    expect(await ensureCognitiveMap(entry())).toBe(false)
  })

  it('releases the in-flight claim after a failure so a retry can run', async () => {
    apiPost.mockRejectedValueOnce(new Error('502'))
    expect(await ensureCognitiveMap(entry())).toBe(false)
    apiPost.mockResolvedValue(response)
    expect(await ensureCognitiveMap(entry())).toBe(true)
  })
})
