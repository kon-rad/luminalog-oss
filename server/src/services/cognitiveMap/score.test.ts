import { describe, it, expect } from 'vitest'
import { hasRealizationMarker, keepScore } from './score'

describe('hasRealizationMarker', () => {
  it.each([
    'I realized I avoid hard conversations.',
    'It hit me that this was never the plan.',
    'It occurred to me halfway through.',
    'What I actually think is simpler.',
    'The truth is I never wanted it.',
    'The real reason is fear.',
    'I keep doing this to myself.',
    'I always leave before it gets hard.',
    "Maybe I'm the problem here.",
    'Why do I do this every time?',
    "I've been telling myself it's fine.",
    'Turns out I was wrong.',
  ])('flags %j', (quote) => {
    expect(hasRealizationMarker(quote)).toBe(true)
  })

  it('is case insensitive', () => {
    expect(hasRealizationMarker('I REALIZED something.')).toBe(true)
  })

  it('does not flag ordinary chronicle', () => {
    expect(hasRealizationMarker('Paid the rent and went to the gym.')).toBe(false)
  })
})

describe('keepScore', () => {
  const base = { generality: 0, degree: 0, crossLinkCount: 0, hasRealizationMarker: false }

  it('is 0 for a beat with no signal at all', () => {
    expect(keepScore(base)).toBe(0)
  })

  it('is 1 when every signal is maxed', () => {
    expect(keepScore({ generality: 1, degree: 3, crossLinkCount: 3, hasRealizationMarker: true }))
      .toBeCloseTo(1)
  })

  it('weights generality most heavily', () => {
    expect(keepScore({ ...base, generality: 1 })).toBeCloseTo(0.44)
  })

  it('saturates degree at 3', () => {
    expect(keepScore({ ...base, degree: 3 })).toBeCloseTo(keepScore({ ...base, degree: 9 }))
  })

  it('adds the realization marker as a flat boost', () => {
    expect(keepScore({ ...base, hasRealizationMarker: true })).toBeCloseTo(0.18)
  })

  it('never exceeds 1', () => {
    expect(keepScore({ generality: 5, degree: 99, crossLinkCount: 99, hasRealizationMarker: true }))
      .toBeLessThanOrEqual(1)
  })

  it('never goes below 0', () => {
    expect(keepScore({ ...base, generality: -5, degree: -3 })).toBe(0)
  })
})
