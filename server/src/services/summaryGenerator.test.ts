import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('./aiClient', () => ({ chatCompletion: vi.fn() }))
vi.mock('../config', () => ({ config: {} }))

import { chatCompletion } from './aiClient'
import { generateSummaryText, SUMMARY_MODEL } from './summaryGenerator'

function mockCompletion(text: string) {
  ;(chatCompletion as any).mockResolvedValue({
    ok: true,
    json: async () => ({ choices: [{ message: { content: `  ${text}  ` } }] }),
  })
}

describe('generateSummaryText', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns trimmed summary text using resolved config', async () => {
    mockCompletion('You reflected on a calm morning.')
    const out = await generateSummaryText({
      type: 'text',
      content: 'Long entry...',
      userConfig: { wordLength: 30, systemPrompt: 'Summarize {type}.' },
    })
    expect(out.text).toBe('You reflected on a calm morning.')
    expect(out.model).toBe(SUMMARY_MODEL)
    const [messages] = (chatCompletion as any).mock.calls[0]
    expect(messages[0].content).toContain('Summarize text.')
    expect(messages[0].content).toMatch(/30 words/)
    expect(messages[1].content).toBe('Long entry...')
  })

  it('throws on non-ok completion', async () => {
    ;(chatCompletion as any).mockResolvedValue({ ok: false, status: 500 })
    await expect(
      generateSummaryText({ type: 'text', content: 'x', userConfig: undefined }),
    ).rejects.toThrow()
  })
})
