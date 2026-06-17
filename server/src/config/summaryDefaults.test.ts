import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SUMMARY_WORD_LENGTH,
  DEFAULT_SUMMARY_SYSTEM_PROMPT,
  resolveSummaryConfig,
} from './summaryDefaults'

describe('summaryDefaults', () => {
  it('exposes sane defaults', () => {
    expect(DEFAULT_SUMMARY_WORD_LENGTH).toBeGreaterThan(0)
    expect(DEFAULT_SUMMARY_SYSTEM_PROMPT).toMatch(/journal/i)
  })

  it('falls back to defaults when user config is absent', () => {
    expect(resolveSummaryConfig(undefined)).toEqual({
      wordLength: DEFAULT_SUMMARY_WORD_LENGTH,
      systemPrompt: DEFAULT_SUMMARY_SYSTEM_PROMPT,
    })
  })

  it('uses user overrides when present and valid', () => {
    const r = resolveSummaryConfig({ wordLength: 80, systemPrompt: 'Custom.' })
    expect(r).toEqual({ wordLength: 80, systemPrompt: 'Custom.' })
  })

  it('ignores blank/invalid overrides', () => {
    expect(resolveSummaryConfig({ wordLength: 0, systemPrompt: '   ' })).toEqual({
      wordLength: DEFAULT_SUMMARY_WORD_LENGTH,
      systemPrompt: DEFAULT_SUMMARY_SYSTEM_PROMPT,
    })
  })
})
