import { describe, it, expect } from 'vitest'
import { VectorIndex } from '@/lib/vectors/vectorIndex'

const unit = (x: number, y: number) => {
  const m = Math.hypot(x, y)
  return new Float32Array([x / m, y / m])
}

describe('VectorIndex.topK', () => {
  it('ranks by cosine similarity, descending', () => {
    const idx = new VectorIndex()
    idx.upsert('a', unit(1, 0))
    idx.upsert('b', unit(0.9, 0.1))
    idx.upsert('c', unit(0, 1))
    const out = idx.topK(2, unit(1, 0))
    expect(out.map((r) => r.entryId)).toEqual(['a', 'b'])
    expect(out[0].score).toBeGreaterThan(out[1].score)
  })

  it('breaks ties on ascending entryId and returns [] for k<=0', () => {
    const idx = new VectorIndex()
    idx.upsert('z', unit(1, 0))
    idx.upsert('a', unit(1, 0))
    expect(idx.topK(2, unit(1, 0)).map((r) => r.entryId)).toEqual(['a', 'z'])
    expect(idx.topK(0, unit(1, 0))).toEqual([])
  })

  it('remove drops an entry and has/size reflect membership', () => {
    const idx = new VectorIndex()
    idx.upsert('a', unit(1, 0))
    expect(idx.has('a')).toBe(true)
    expect(idx.size).toBe(1)
    idx.remove('a')
    expect(idx.has('a')).toBe(false)
    expect(idx.size).toBe(0)
  })
})
