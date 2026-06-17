import { describe, it, expect } from 'vitest'
import { PROMPTS } from './prompts'

describe('PROMPTS.summary', () => {
  it('injects type, system prompt and word length', () => {
    const p = PROMPTS.summary('voice', { wordLength: 40, systemPrompt: 'Be brief about {type}.' })
    expect(p).toContain('voice')          // {type} substituted
    expect(p).toContain('Be brief about voice.')
    expect(p).toMatch(/40 words/)
  })
})
