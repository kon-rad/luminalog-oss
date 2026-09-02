import { describe, it, expect } from 'vitest'
import {
  parseEncouragements,
  fallbackEncouragements,
  ENCOURAGEMENT_COUNT,
  ENCOURAGEMENT_TITLE_MAX,
  ENCOURAGEMENT_BODY_MAX,
} from './dailyEncouragements'

describe('parseEncouragements', () => {
  it('maps a well-formed JSON response into five items', () => {
    const raw = JSON.stringify({
      messages: Array.from({ length: 5 }, (_, i) => ({ title: `T${i}`, body: `B${i}` })),
    })
    const out = parseEncouragements(raw)
    expect(out).not.toBeNull()
    expect(out!).toHaveLength(ENCOURAGEMENT_COUNT)
    expect(out![0]).toEqual({ title: 'T0', body: 'B0' })
  })

  it('tolerates prose around the JSON object', () => {
    const raw = `Sure!\n{"messages":[{"title":"Keep going","body":"You named the hard part."}]}\nDone.`
    const out = parseEncouragements(raw)
    expect(out).not.toBeNull()
    expect(out![0]).toEqual({ title: 'Keep going', body: 'You named the hard part.' })
  })

  it('pads a short list with fallbacks so callers always get five', () => {
    const raw = JSON.stringify({ messages: [{ title: 'One', body: 'Only one.' }] })
    const out = parseEncouragements(raw)!
    expect(out).toHaveLength(ENCOURAGEMENT_COUNT)
    expect(out[0].title).toBe('One')
    expect(out[4].title.length).toBeGreaterThan(0)
    expect(out[4].body.length).toBeGreaterThan(0)
  })

  it('drops entries with a blank body and pads to five', () => {
    const raw = JSON.stringify({
      messages: [{ title: 'Kept', body: 'Real.' }, { title: 'Dropped', body: '   ' }],
    })
    const out = parseEncouragements(raw)!
    expect(out).toHaveLength(ENCOURAGEMENT_COUNT)
    expect(out.some(m => m.title === 'Dropped')).toBe(false)
  })

  it('clamps over-long titles and bodies to the notification limits', () => {
    const raw = JSON.stringify({
      messages: [{ title: 'x'.repeat(120), body: 'y'.repeat(500) }],
    })
    const out = parseEncouragements(raw)!
    expect(out[0].title.length).toBeLessThanOrEqual(ENCOURAGEMENT_TITLE_MAX)
    expect(out[0].body.length).toBeLessThanOrEqual(ENCOURAGEMENT_BODY_MAX)
  })

  it('returns null when no JSON object is present so the caller can retry', () => {
    expect(parseEncouragements('I cannot help with that.')).toBeNull()
  })

  it('returns null on malformed JSON so the caller can retry', () => {
    expect(parseEncouragements('{"messages": [ broken')).toBeNull()
  })
})

describe('fallbackEncouragements', () => {
  it('returns five non-empty messages within the length limits', () => {
    const out = fallbackEncouragements()
    expect(out).toHaveLength(ENCOURAGEMENT_COUNT)
    for (const m of out) {
      expect(m.title.trim().length).toBeGreaterThan(0)
      expect(m.body.trim().length).toBeGreaterThan(0)
      expect(m.title.length).toBeLessThanOrEqual(ENCOURAGEMENT_TITLE_MAX)
      expect(m.body.length).toBeLessThanOrEqual(ENCOURAGEMENT_BODY_MAX)
    }
  })
})
