import { describe, it, expect } from 'vitest'
import { pcaTo3D } from './pca'

const dist = (a: { x: number; y: number; z: number }, b: typeof a) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

describe('pcaTo3D', () => {
  it('returns [] for no vectors', () => {
    expect(pcaTo3D([])).toEqual([])
  })

  it('places a single day at the origin', () => {
    expect(pcaTo3D([[1, 2, 3, 4]])).toEqual([{ x: 0, y: 0, z: 0 }])
  })

  it('two days span only the first axis (y=z=0) and are symmetric', () => {
    const pts = pcaTo3D([[0, 0, 0], [10, 0, 0]])
    expect(pts).toHaveLength(2)
    for (const p of pts) {
      expect(p.y).toBe(0)
      expect(p.z).toBe(0)
    }
    expect(pts[0].x).toBeCloseTo(-pts[1].x, 6) // centered → symmetric
  })

  it('three days never use the third axis (z=0)', () => {
    const pts = pcaTo3D([[1, 0, 0], [0, 1, 0], [-1, -1, 0]])
    for (const p of pts) expect(p.z).toBeCloseTo(0, 6)
  })

  it('is deterministic across calls', () => {
    const v = [[1, 2, 3], [4, 1, 0], [2, 2, 9], [7, 0, 1], [0, 5, 5]]
    expect(pcaTo3D(v)).toEqual(pcaTo3D(v))
  })

  it('keeps all coordinates inside the unit cube', () => {
    const v = [[3, 1, 4, 1], [5, 9, 2, 6], [5, 3, 5, 8], [9, 7, 9, 3]]
    for (const p of pcaTo3D(v)) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1 + 1e-9)
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1 + 1e-9)
      expect(Math.abs(p.z)).toBeLessThanOrEqual(1 + 1e-9)
    }
  })

  it('spreads identical vectors onto distinct points inside the unit cube', () => {
    const pts = pcaTo3D([[1, 1, 1], [1, 1, 1]])
    expect(pts).toHaveLength(2)
    expect(dist(pts[0], pts[1])).toBeGreaterThan(1e-6) // not both at the origin
    for (const p of pts) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1 + 1e-9)
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1 + 1e-9)
      expect(Math.abs(p.z)).toBeLessThanOrEqual(1 + 1e-9)
    }
  })

  it('keeps within-cluster days closer than across-cluster days', () => {
    // Two tight clusters separated along dimension 0.
    const A1 = [0.0, 1, 0], A2 = [0.1, 1.1, 0.1]
    const B1 = [20.0, 1, 0], B2 = [20.1, 1.1, 0.1]
    const [a1, a2, b1, b2] = pcaTo3D([A1, A2, B1, B2])
    expect(dist(a1, a2)).toBeLessThan(dist(a1, b1))
    expect(dist(b1, b2)).toBeLessThan(dist(a2, b2))
  })
})
