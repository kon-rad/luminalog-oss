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
    const p = PROMPTS.chatSystem('Ada Lovelace', 'I write poetry.', 'Entry about poems.')
    expect(p).toContain('Ada Lovelace')
    expect(p).toContain('I write poetry.')
    expect(p).toContain('Entry about poems.')
  })

  it('degrades gracefully with an empty name', () => {
    const p = PROMPTS.chatSystem('', 'bio', 'ctx')
    expect(p).not.toContain('USER\'S NAME:')
  })
})

describe('PROMPTS.voiceChat', () => {
  it('includes the user name and bio', () => {
    const p = PROMPTS.voiceChat('Ada Lovelace', 'I write poetry.', 'Entry about poems.')
    expect(p).toContain('Ada Lovelace')
    expect(p).toContain('I write poetry.')
  })
})

describe('DEFAULT_SUMMARY_SYSTEM_PROMPT', () => {
  it('is the canonical summary prompt text living in prompts.ts', () => {
    expect(DEFAULT_SUMMARY_SYSTEM_PROMPT).toContain('{type}')
    expect(DEFAULT_SUMMARY_SYSTEM_PROMPT).toContain('second person')
  })
})
