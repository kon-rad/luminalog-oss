import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiPost = vi.fn()

vi.mock('@/lib/api/client', () => ({
  apiPost: (...args: unknown[]) => apiPost(...args),
}))

import { fetchGraph, type JournalGraph } from './graph'

describe('lib/api/graph', () => {
  beforeEach(() => {
    apiPost.mockReset()
  })

  it('fetchGraph posts to /api/rag/graph with an empty body and returns the typed payload', async () => {
    const payload: JournalGraph = {
      nodes: [{ id: 'j1', title: 'First entry', date: '2026-07-01', type: 'text', degree: 2 }],
      links: [{ source: 'j1', target: 'j2', value: 0.82 }],
    }
    apiPost.mockResolvedValueOnce(payload)

    const result = await fetchGraph()

    expect(apiPost).toHaveBeenCalledWith('/api/rag/graph', {})
    expect(result).toEqual(payload)
  })
})
