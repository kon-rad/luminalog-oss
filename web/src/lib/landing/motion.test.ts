import { describe, it, expect } from 'vitest'
import { wordsForProgress } from './motion'

describe('wordsForProgress', () => {
  it('returns 0 at progress 0', () => {
    expect(wordsForProgress(0)).toBe(0)
  })

  it('returns the goal at progress 1', () => {
    expect(wordsForProgress(1)).toBe(750)
  })

  it('returns half the goal at progress 0.5', () => {
    expect(wordsForProgress(0.5)).toBe(375)
  })

  it('clamps progress above 1', () => {
    expect(wordsForProgress(1.4)).toBe(750)
  })

  it('clamps progress below 0', () => {
    expect(wordsForProgress(-0.2)).toBe(0)
  })

  it('supports a custom goal', () => {
    expect(wordsForProgress(0.5, 100)).toBe(50)
  })
})
