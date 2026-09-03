import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiPost = vi.fn()
const apiGet = vi.fn()

vi.mock('@/lib/api/client', () => ({
  apiPost: (...a: unknown[]) => apiPost(...a),
  apiGet: (...a: unknown[]) => apiGet(...a),
}))

const { fetchPeriodPositions, generatePeriodNarrative } = await import('./periodPyramid')

beforeEach(() => {
  apiPost.mockReset()
  apiGet.mockReset()
})

describe('fetchPeriodPositions', () => {
  it('GETs the tier and returns its points', async () => {
    apiGet.mockResolvedValue({ points: [{ periodIndex: 1, x: 0, y: 0, z: 0, childCount: 2, parentIndex: 5 }] })
    const points = await fetchPeriodPositions('week')
    expect(apiGet).toHaveBeenCalledWith('/v1/ai/period-positions/week')
    expect(points).toHaveLength(1)
  })
})

describe('generatePeriodNarrative', () => {
  const days = [{ dayIndex: 100, beats: [{ text: 'Shipped', kind: 'event', domain: 'craft', isSpine: true }] }]

  it('POSTs a job, polls it, and returns the narrative once done', async () => {
    apiPost.mockResolvedValue({ jobId: 'job-1', status: 'pending' })
    apiGet.mockResolvedValue({ status: 'done', narrative: 'A steady week of shipping.' })

    const narrative = await generatePeriodNarrative('week', 42, days, { pollIntervalMs: 0, pollCeilingMs: 1000 })

    expect(apiPost).toHaveBeenCalledWith('/v1/ai/period-narrative', { periodType: 'week', periodIndex: 42, days })
    expect(apiGet).toHaveBeenCalledWith('/v1/ai/period-narrative/job-1')
    expect(narrative).toBe('A steady week of shipping.')
  })

  it('returns null when the job fails', async () => {
    apiPost.mockResolvedValue({ jobId: 'job-1', status: 'pending' })
    apiGet.mockResolvedValue({ status: 'failed', error: 'boom' })
    const narrative = await generatePeriodNarrative('week', 42, days, { pollIntervalMs: 0, pollCeilingMs: 1000 })
    expect(narrative).toBeNull()
  })

  it('returns null when the poll ceiling is reached', async () => {
    apiPost.mockResolvedValue({ jobId: 'job-1', status: 'pending' })
    apiGet.mockResolvedValue({ status: 'pending' })
    const narrative = await generatePeriodNarrative('week', 42, days, { pollIntervalMs: 0, pollCeilingMs: 5 })
    expect(narrative).toBeNull()
  })
})
