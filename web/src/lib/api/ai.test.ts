import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiPost = vi.fn()

vi.mock('@/lib/api/client', () => ({
  apiPost: (...args: unknown[]) => apiPost(...args),
}))

import { fetchSummary, fetchDailyPrompt, fetchRelated, searchKeyword, searchSemantic } from './ai'

describe('lib/api/ai', () => {
  beforeEach(() => {
    apiPost.mockReset()
  })

  it('fetchSummary posts to /api/ai/summary with the journalId and returns the payload', async () => {
    const payload = { text: 'a summary', model: 'gpt', generatedAt: '2026-07-04T00:00:00.000Z' }
    apiPost.mockResolvedValueOnce(payload)

    const result = await fetchSummary('journal-1')

    expect(apiPost).toHaveBeenCalledWith('/api/ai/summary', { journalId: 'journal-1' })
    expect(result).toEqual(payload)
  })

  it('fetchDailyPrompt posts to /api/ai/daily-prompt with an empty body and returns the payload', async () => {
    const payload = {
      prompts: [{ area: 'gratitude', text: 'What are you grateful for?' }],
      text: 'What are you grateful for?',
      sourceEntryIds: ['e1'],
    }
    apiPost.mockResolvedValueOnce(payload)

    const result = await fetchDailyPrompt()

    expect(apiPost).toHaveBeenCalledWith('/api/ai/daily-prompt', {})
    expect(result).toEqual(payload)
  })

  it('fetchRelated omits limit when undefined', async () => {
    const payload = { related: [] }
    apiPost.mockResolvedValueOnce(payload)

    const result = await fetchRelated('journal-1')

    expect(apiPost).toHaveBeenCalledWith('/api/rag/related', { journalId: 'journal-1' })
    expect(result).toEqual(payload)
  })

  it('fetchRelated includes limit when passed', async () => {
    const payload = { related: [] }
    apiPost.mockResolvedValueOnce(payload)

    await fetchRelated('journal-1', 10)

    expect(apiPost).toHaveBeenCalledWith('/api/rag/related', { journalId: 'journal-1', limit: 10 })
  })

  it('searchKeyword posts the trimmed query to /api/rag/search/keyword and returns the payload', async () => {
    const payload = { results: [] }
    apiPost.mockResolvedValueOnce(payload)

    const result = await searchKeyword('  hello  ')

    expect(apiPost).toHaveBeenCalledWith('/api/rag/search/keyword', { query: 'hello' })
    expect(result).toEqual(payload)
  })

  it('searchSemantic posts the trimmed query to /api/rag/search/semantic and returns the payload', async () => {
    const payload = { results: [] }
    apiPost.mockResolvedValueOnce(payload)

    const result = await searchSemantic('  world  ')

    expect(apiPost).toHaveBeenCalledWith('/api/rag/search/semantic', { query: 'world' })
    expect(result).toEqual(payload)
  })

  it('searchKeyword throws on an empty/whitespace-only query without calling apiPost', () => {
    expect(() => searchKeyword('   ')).toThrow('empty query')
    expect(apiPost).not.toHaveBeenCalled()
  })

  it('searchSemantic throws on an empty/whitespace-only query without calling apiPost', () => {
    expect(() => searchSemantic('')).toThrow('empty query')
    expect(apiPost).not.toHaveBeenCalled()
  })

  it('searchKeyword throws on an oversized query without calling apiPost', () => {
    const longQuery = 'a'.repeat(501)
    expect(() => searchKeyword(longQuery)).toThrow('query too long')
    expect(apiPost).not.toHaveBeenCalled()
  })
})
