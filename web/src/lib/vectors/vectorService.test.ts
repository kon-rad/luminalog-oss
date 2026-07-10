import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({ apiGet: vi.fn(), apiPost: vi.fn(), apiDelete: vi.fn() }))
vi.mock('@/lib/api/client', () => ({
  apiGet: (...a: unknown[]) => mocks.apiGet(...a),
  apiPost: (...a: unknown[]) => mocks.apiPost(...a),
  apiDelete: (...a: unknown[]) => mocks.apiDelete(...a),
}))

import { listVectors, upsertVectors, deleteVector } from '@/lib/vectors/vectorService'

beforeEach(() => {
  mocks.apiGet.mockReset()
  mocks.apiPost.mockReset()
  mocks.apiDelete.mockReset()
})

describe('vectorService', () => {
  it('lists via GET /api/vectors and unwraps the {vectors} envelope', async () => {
    mocks.apiGet.mockResolvedValue({ vectors: [{ entryId: 'e1', blob: 'b', dim: 512, model: 'distiluse-multilingual-v1' }] })
    const out = await listVectors()
    expect(mocks.apiGet).toHaveBeenCalledWith('/api/vectors')
    expect(out[0].entryId).toBe('e1')
  })

  it('batch-upserts via POST /api/vectors', async () => {
    mocks.apiPost.mockResolvedValue({ ok: true, count: 1 })
    await upsertVectors([{ entryId: 'e1', blob: 'b', dim: 512, model: 'distiluse-multilingual-v1' }])
    expect(mocks.apiPost).toHaveBeenCalledWith('/api/vectors', { vectors: [expect.objectContaining({ entryId: 'e1' })] })
  })

  it('deletes via DELETE /api/vectors/:id', async () => {
    mocks.apiDelete.mockResolvedValue({ deleted: true })
    await deleteVector('e1')
    expect(mocks.apiDelete).toHaveBeenCalledWith('/api/vectors/e1')
  })

  it('returns an empty list when the server sends no vectors field', async () => {
    mocks.apiGet.mockResolvedValue({})
    expect(await listVectors()).toEqual([])
  })
})
