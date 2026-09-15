import { describe, it, expect } from 'vitest'
import {
  cleanEcho, fallbackEcho, fallbackMirrorEchoes, parseMirrorEchoes,
  MIRROR_TEXT_MAX, MIRROR_TIME_SLOTS,
} from './dailyMirror'

describe('cleanEcho', () => {
  it('trims surrounding whitespace', () => {
    expect(cleanEcho('  You already know the next step.  \n')).toBe('You already know the next step.')
  })

  it('strips a wrapping quote pair the model added anyway', () => {
    expect(cleanEcho('"You already know the next step."')).toBe('You already know the next step.')
    expect(cleanEcho("'You already know the next step.'")).toBe('You already know the next step.')
    expect(cleanEcho('“You already know the next step.”')).toBe('You already know the next step.')
  })

  it('does not strip a quote character that only opens, not closes', () => {
    expect(cleanEcho('"Half quoted.')).toBe('"Half quoted.')
  })

  it('leaves an internal quote alone', () => {
    expect(cleanEcho('You called it "the hard call" three times this week.'))
      .toBe('You called it "the hard call" three times this week.')
  })

  it('clamps to the notification-safe length', () => {
    const out = cleanEcho('x'.repeat(400))
    expect(out.length).toBeLessThanOrEqual(MIRROR_TEXT_MAX)
  })

  it('returns empty string for blank input', () => {
    expect(cleanEcho('   ')).toBe('')
  })
})

describe('fallbackEcho', () => {
  it('returns a distinct, non-empty sentence for each time of day', () => {
    const sentences = MIRROR_TIME_SLOTS.map(fallbackEcho)
    for (const s of sentences) {
      expect(s.trim().length).toBeGreaterThan(0)
      expect(s.length).toBeLessThanOrEqual(MIRROR_TEXT_MAX)
    }
    expect(new Set(sentences).size).toBe(sentences.length)
  })
})

describe('fallbackMirrorEchoes', () => {
  it('returns all three slots, each matching fallbackEcho', () => {
    const echoes = fallbackMirrorEchoes()
    for (const timeOfDay of MIRROR_TIME_SLOTS) {
      expect(echoes[timeOfDay]).toBe(fallbackEcho(timeOfDay))
    }
  })
})

describe('parseMirrorEchoes', () => {
  it('parses a clean JSON object into all three slots', () => {
    const echoes = parseMirrorEchoes(JSON.stringify({
      morning: 'Name the thing you are avoiding before the day fills up.',
      afternoon: 'The friction today is just information.',
      evening: 'Let today be enough as it is.',
    }))
    expect(echoes).toEqual({
      morning: 'Name the thing you are avoiding before the day fills up.',
      afternoon: 'The friction today is just information.',
      evening: 'Let today be enough as it is.',
    })
  })

  it('tolerates prose wrapped around the JSON object', () => {
    const echoes = parseMirrorEchoes(
      `Here you go:\n${JSON.stringify({ morning: 'A.', afternoon: 'B.', evening: 'C.' })}\nHope that helps!`
    )
    expect(echoes).toEqual({ morning: 'A.', afternoon: 'B.', evening: 'C.' })
  })

  it('strips a wrapping quote pair from an individual slot value', () => {
    const echoes = parseMirrorEchoes(JSON.stringify({
      morning: '"Quoted morning."', afternoon: 'Afternoon.', evening: 'Evening.',
    }))
    expect(echoes?.morning).toBe('Quoted morning.')
  })

  it('falls back a slot individually when it is missing or blank, without failing the batch', () => {
    const echoes = parseMirrorEchoes(JSON.stringify({ morning: 'Only morning.', afternoon: '' }))
    expect(echoes?.morning).toBe('Only morning.')
    expect(echoes?.afternoon).toBe(fallbackEcho('afternoon'))
    expect(echoes?.evening).toBe(fallbackEcho('evening'))
  })

  it('returns null when no JSON object is present', () => {
    expect(parseMirrorEchoes('not json at all')).toBeNull()
  })

  it('returns null when the matched braces do not contain valid JSON', () => {
    expect(parseMirrorEchoes('{"morning": ,}')).toBeNull()
  })
})
