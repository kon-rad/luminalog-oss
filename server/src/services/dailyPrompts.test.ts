import { describe, it, expect } from 'vitest'
import { parseDailyPrompts, DAILY_PROMPT_AREAS } from './dailyPrompts'

describe('parseDailyPrompts', () => {
  it('maps a well-formed JSON response into one item per area, in order', () => {
    const raw = JSON.stringify({
      prompts: DAILY_PROMPT_AREAS.map(area => ({ area, question: `Q for ${area}?` })),
    })
    const out = parseDailyPrompts(raw)
    expect(out).not.toBeNull()
    expect(out!.map(p => p.area)).toEqual([...DAILY_PROMPT_AREAS])
    expect(out![0].text).toBe(`Q for ${DAILY_PROMPT_AREAS[0]}?`)
  })

  it('tolerates prose around the JSON object', () => {
    const raw = `Sure! Here you go:\n{"prompts":[{"area":"Relationships","question":"Who mattered today?"}]}\nHope that helps.`
    const out = parseDailyPrompts(raw)
    expect(out).not.toBeNull()
    expect(out!).toHaveLength(DAILY_PROMPT_AREAS.length)
    expect(out![0]).toEqual({ area: 'Relationships', text: 'Who mattered today?' })
  })

  it('fills a gentle fallback for any area the model omitted', () => {
    const raw = JSON.stringify({ prompts: [{ area: 'Work & Purpose', question: 'What did you build?' }] })
    const out = parseDailyPrompts(raw)!
    expect(out).toHaveLength(DAILY_PROMPT_AREAS.length)
    const work = out.find(p => p.area === 'Work & Purpose')!
    expect(work.text).toBe('What did you build?')
    // An omitted area still gets a non-empty question ending in '?'.
    const rel = out.find(p => p.area === 'Relationships')!
    expect(rel.text.endsWith('?')).toBe(true)
  })

  it('accepts a "text" key as an alias for "question"', () => {
    const raw = JSON.stringify({ prompts: [{ area: 'Joy & Play', text: 'What made you smile?' }] })
    const out = parseDailyPrompts(raw)!
    expect(out.find(p => p.area === 'Joy & Play')!.text).toBe('What made you smile?')
  })

  it('returns null when no JSON object is present (so the caller can retry)', () => {
    expect(parseDailyPrompts('no json here, just words')).toBeNull()
    expect(parseDailyPrompts('')).toBeNull()
  })
})
