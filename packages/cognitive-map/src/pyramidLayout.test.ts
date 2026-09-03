import { describe, it, expect } from 'vitest'
import { layoutPyramid } from './pyramidLayout'

describe('layoutPyramid', () => {
  it('returns an empty layout for no points', () => {
    const result = layoutPyramid([])
    expect(result.points).toEqual([])
    expect(result.width).toBeGreaterThan(0)
    expect(result.height).toBeGreaterThan(0)
  })

  it('centers a single point regardless of its raw coordinates', () => {
    const result = layoutPyramid([{ periodIndex: 1, x: 500, y: -300, childCount: 1 }])
    expect(result.points).toHaveLength(1)
    expect(result.points[0]!.x).toBeCloseTo(result.width / 2, 0)
    expect(result.points[0]!.y).toBeCloseTo(result.height / 2, 0)
  })

  it('spreads points across the canvas in proportion to their raw spread', () => {
    const result = layoutPyramid([
      { periodIndex: 1, x: 0, y: 0, childCount: 1 },
      { periodIndex: 2, x: 10, y: 0, childCount: 1 },
    ])
    const [a, b] = result.points
    expect(a!.x).toBeLessThan(b!.x)
  })

  it('sizes radius by childCount on a log scale, larger childCount never smaller', () => {
    const result = layoutPyramid([
      { periodIndex: 1, x: 0, y: 0, childCount: 1 },
      { periodIndex: 2, x: 1, y: 1, childCount: 50 },
    ])
    const [small, big] = result.points
    expect(big!.r).toBeGreaterThan(small!.r)
  })

  it('flags hasNarrative from the provided set', () => {
    const result = layoutPyramid(
      [{ periodIndex: 1, x: 0, y: 0, childCount: 1 }],
      new Set([1]),
    )
    expect(result.points[0]!.hasNarrative).toBe(true)
  })

  it('defaults hasNarrative to false when no set is given', () => {
    const result = layoutPyramid([{ periodIndex: 1, x: 0, y: 0, childCount: 1 }])
    expect(result.points[0]!.hasNarrative).toBe(false)
  })
})
