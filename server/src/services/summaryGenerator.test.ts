import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('./aiClient', () => ({ chatCompletion: vi.fn() }))
vi.mock('../config', () => ({ config: {} }))

import { chatCompletion } from './aiClient'
import { generateSummaryText, generateEntryAI, parseEntryAI, SUMMARY_MODEL } from './summaryGenerator'

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

describe('parseEntryAI', () => {
  it('parses a clean JSON object', () => {
    const out = parseEntryAI('{"summary":"s","insights":"## T\\n- p","prompts":["a?","b?","c?","d?","e?"]}')
    expect(out).toEqual({ summary: 's', insights: '## T\n- p', prompts: ['a?', 'b?', 'c?', 'd?', 'e?'] })
  })

  it('tolerates prose / code fences around the JSON', () => {
    const raw = 'Here you go:\n```json\n{"summary":"s","insights":"i","prompts":["a?"]}\n```'
    expect(parseEntryAI(raw)).toEqual({ summary: 's', insights: 'i', prompts: ['a?'] })
  })

  it('drops prompts that are not questions and clamps to 5', () => {
    const raw = '{"summary":"s","insights":"i","prompts":["a?","not a question","b?","c?","d?","e?","f?"]}'
    expect(parseEntryAI(raw)!.prompts).toEqual(['a?', 'b?', 'c?', 'd?', 'e?'])
  })

  it('returns null when there is no JSON', () => {
    expect(parseEntryAI('sorry, I could not do that')).toBeNull()
  })

  it('returns null when the summary is empty', () => {
    expect(parseEntryAI('{"summary":"","insights":"i","prompts":["a?"]}')).toBeNull()
  })

  it('coerces missing insights/prompts to safe defaults', () => {
    expect(parseEntryAI('{"summary":"s"}')).toEqual({ summary: 's', insights: '', prompts: [] })
  })
})

describe('generateEntryAI', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('requests JSON mode and returns the parsed sections + model', async () => {
    mockCompletion('{"summary":"You rested.","insights":"## Rest","prompts":["What next?"]}')
    const out = await generateEntryAI({ type: 'text', content: 'Long entry...', userConfig: undefined })
    expect(out.summary).toBe('You rested.')
    expect(out.insights).toBe('## Rest')
    expect(out.prompts).toEqual(['What next?'])
    expect(out.model).toBe(SUMMARY_MODEL)
    const [messages, opts] = (chatCompletion as any).mock.calls[0]
    expect(messages[1].content).toBe('Long entry...')
    expect(opts.response_format).toEqual({ type: 'json_object' })
  })

  it('throws on an unparseable response', async () => {
    mockCompletion('not json at all')
    await expect(
      generateEntryAI({ type: 'text', content: 'x', userConfig: undefined }),
    ).rejects.toThrow()
  })
})
