import { describe, it, expect } from 'vitest'
import { PROMPTS, DEFAULT_SUMMARY_SYSTEM_PROMPT } from './prompts'

describe('PROMPTS.summary', () => {
  it('injects type, system prompt and word length', () => {
    const p = PROMPTS.summary('voice', { wordLength: 40, systemPrompt: 'Be brief about {type}.' })
    expect(p).toContain('voice')          // {type} substituted
    expect(p).toContain('Be brief about voice.')
    expect(p).toMatch(/40 words/)
  })
})

describe('PROMPTS.chatSystem', () => {
  it('includes the user name and bio', () => {
    const p = PROMPTS.chatSystem('Ada Lovelace', 'I write poetry.', {}, 'Entry about poems.')
    expect(p).toContain('Ada Lovelace')
    expect(p).toContain('I write poetry.')
    expect(p).toContain('Entry about poems.')
  })

  it('degrades gracefully with an empty name', () => {
    const p = PROMPTS.chatSystem('', 'bio', {}, 'ctx')
    expect(p).not.toContain('USER\'S NAME:')
  })

  it('includes filled profile fields and omits empty ones', () => {
    const p = PROMPTS.chatSystem('Ada', 'bio', { age: '30', goals: 'Build things' }, '')
    expect(p).toContain('USER PROFILE:')
    expect(p).toContain('- Age: 30')
    expect(p).toContain('- Goals: Build things')
    expect(p).not.toContain('- Lives in:')
  })

  it('omits the profile block entirely when no fields are set', () => {
    const p = PROMPTS.chatSystem('Ada', 'bio', {}, '')
    expect(p).not.toContain('USER PROFILE:')
  })
})

describe('PROMPTS.voiceChat', () => {
  it('includes the user name and bio', () => {
    const p = PROMPTS.voiceChat('Ada Lovelace', 'I write poetry.', {}, 'Entry about poems.')
    expect(p).toContain('Ada Lovelace')
    expect(p).toContain('I write poetry.')
  })

  it('includes the profile block when fields are set', () => {
    const p = PROMPTS.voiceChat('Ada', 'bio', { location: 'Berlin' }, '')
    expect(p).toContain('USER PROFILE:')
    expect(p).toContain('- Lives in: Berlin')
  })

  it('includes the memory block when memory is provided', () => {
    const p = PROMPTS.voiceChat('Ada', 'bio', {}, '', undefined, undefined, undefined, 'This week so far: You shipped.')
    expect(p).toContain('WHAT YOU REMEMBER ABOUT THEIR LIFE')
    expect(p).toContain('This week so far: You shipped.')
  })

  it('omits the memory block when memory is absent', () => {
    expect(PROMPTS.voiceChat('Ada', 'bio', {}, '')).not.toContain('WHAT YOU REMEMBER')
  })
})

describe('DEFAULT_SUMMARY_SYSTEM_PROMPT', () => {
  it('is the canonical summary prompt text living in prompts.ts', () => {
    expect(DEFAULT_SUMMARY_SYSTEM_PROMPT).toContain('{type}')
    expect(DEFAULT_SUMMARY_SYSTEM_PROMPT).toContain('second person')
  })
})

describe('PROMPTS.dailyReport', () => {
  const p = PROMPTS.dailyReport({
    name: 'Sam',
    todayText: 'Rested all day.',
    relatedContext: 'Past: worked too hard.',
    topEmotions: [{ name: 'Calmness', score: 0.8 }],
  })
  it('demands strict JSON with the five keys', () => {
    expect(p).toMatch(/insights/); expect(p).toMatch(/findings/)
    expect(p).toMatch(/gem/); expect(p).toMatch(/emotionSummary/)
    expect(p).toMatch(/imageQuery/); expect(p).toMatch(/JSON/i)
  })
  it('encodes the public/share-safe privacy constraints', () => {
    expect(p).toMatch(/public|shareable|share/i)
    expect(p).toMatch(/never|do not|don't/i)
    expect(p).toMatch(/name|people|place|health|financ/i)
  })
})

describe('PROMPTS.periodSummary', () => {
  const base = { periodType: 'week' as const, periodLabel: 'Week of Mon 21 Sep 2026', childrenBlock: '[Mon]\nYou shipped.' }

  it('includes the label, the inputs, and the JSON contract', () => {
    const p = PROMPTS.periodSummary({ ...base, isOpen: false })
    expect(p).toContain('Week of Mon 21 Sep 2026')
    expect(p).toContain('[Mon]\nYou shipped.')
    expect(p).toContain('{"title":"…","sentence":"…","summary":"…","salience":5,"anchors":[{"entryId":"…","quote":"…"}],"keyScenes":{"high":null,"low":null,"turning":null},"threads":["…"]}')
    expect(p).not.toContain('SO FAR')
  })

  it('tells the model an open period is still in progress', () => {
    expect(PROMPTS.periodSummary({ ...base, isOpen: true })).toContain('SO FAR')
  })

  it('describes day inputs as entries and higher tiers as shorter periods', () => {
    expect(PROMPTS.periodSummary({ ...base, periodType: 'day', isOpen: false })).toContain('journal entries')
    expect(PROMPTS.periodSummary({ ...base, isOpen: false })).toContain('shorter periods')
  })

  it('demands verbatim quotes and forbids an invented resolution', () => {
    const p = PROMPTS.periodSummary({ ...base, isOpen: false })
    expect(p).toContain('word for word')
    expect(p).toContain('Do not resolve what the person has not resolved')
  })
})
