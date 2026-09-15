import { describe, it, expect } from 'vitest'
import { generateSoulDemoPoints } from './soulDemoPoints'

describe('generateSoulDemoPoints', () => {
  it('returns the requested number of points', () => {
    expect(generateSoulDemoPoints(10)).toHaveLength(10)
  })

  it('defaults to 48 points', () => {
    expect(generateSoulDemoPoints()).toHaveLength(48)
  })

  it('is deterministic across calls, for a stable server/client render', () => {
    expect(generateSoulDemoPoints(20)).toEqual(generateSoulDemoPoints(20))
  })

  it('keeps word counts within a plausible daily range', () => {
    for (const p of generateSoulDemoPoints(48)) {
      expect(p.wordCount).toBeGreaterThanOrEqual(200)
      expect(p.wordCount).toBeLessThanOrEqual(1600)
    }
  })

  it('every point has finite x, y, z coordinates', () => {
    for (const p of generateSoulDemoPoints(48)) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
      expect(Number.isFinite(p.z)).toBe(true)
    }
  })
})
