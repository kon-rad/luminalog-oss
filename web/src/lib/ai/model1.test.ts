import { describe, it, expect } from 'vitest'
import { journalContext, formatContext } from '@/lib/ai/model1'

const entries = [
  { id: 'e1', type: 'text', title: 'Ocean', content: 'The sea was calm.', createdAt: new Date('2026-07-01T00:00:00Z') },
  { id: 'e2', type: 'text', title: 'Work', content: 'Shipped a feature.', createdAt: new Date('2026-07-02T00:00:00Z') },
]

describe('formatContext', () => {
  it('emits the exact server-shaped block with a UTC date', () => {
    const s = formatContext(
      [{ type: 'text', title: 'Ocean', createdAt: new Date('2026-07-01T12:00:00Z'), content: 'The sea was calm.' }],
      500,
    )
    expect(s).toBe('[#1 — text · Ocean · 2026-07-01]\nThe sea was calm.')
  })

  it('joins multiple blocks with a blank line and truncates snippets', () => {
    const s = formatContext(
      [
        { type: 'text', title: 'A', createdAt: new Date('2026-07-01T00:00:00Z'), content: 'hello world' },
        { type: 'voice', title: 'B', createdAt: new Date('2026-07-02T00:00:00Z'), content: 'foobar' },
      ],
      5,
    )
    expect(s).toBe('[#1 — text · A · 2026-07-01]\nhello\n\n[#2 — voice · B · 2026-07-02]\nfooba')
  })
})

describe('journalContext', () => {
  it('uses the semantic searcher order when it returns ids', async () => {
    const searcher = { search: async () => [{ entryId: 'e2', score: 1 }, { entryId: 'e1', score: 0.9 }] }
    const out = await journalContext('anything', entries, { searcher, topK: 5 })
    expect(out.indexOf('Work')).toBeLessThan(out.indexOf('Ocean'))
  })

  it('falls back to keyword ranking when there is no searcher', async () => {
    const out = await journalContext('ocean', entries, {})
    expect(out).toContain('Ocean')
  })

  it('falls back to keyword ranking when the searcher returns nothing', async () => {
    const searcher = { search: async () => [] }
    const out = await journalContext('ocean', entries, { searcher })
    expect(out).toContain('Ocean')
  })
})
