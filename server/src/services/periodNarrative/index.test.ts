import { describe, it, expect, vi, beforeEach } from 'vitest'

const chatCompletion = vi.fn()
const chatModelChain = vi.fn(() => ['model-a', 'model-b'])

vi.mock('../aiClient', () => ({
  chatCompletion: (...args: unknown[]) => chatCompletion(...args),
  chatModelChain: () => chatModelChain(),
}))

import { generatePeriodNarrative } from './index'
import type { PeriodNarrativeDayInput } from './chunk'

const ok = (content: string) => ({
  ok: true,
  json: async () => ({ choices: [{ message: { content } }] }),
})

function dayWith(dayIndex: number, beatCount: number): PeriodNarrativeDayInput {
  return {
    dayIndex,
    beats: Array.from({ length: beatCount }, (_, i) => ({
      text: `beat ${dayIndex}-${i}`, kind: 'event', domain: 'craft', isSpine: i === 0,
    })),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  chatModelChain.mockReturnValue(['model-a', 'model-b'])
})

describe('generatePeriodNarrative', () => {
  it('makes exactly one call for a period that fits in a single chunk', async () => {
    chatCompletion.mockResolvedValueOnce(ok('You shipped the beta this week.'))
    const result = await generatePeriodNarrative({
      periodType: 'week', days: [dayWith(1, 3)],
    })
    expect(chatCompletion).toHaveBeenCalledTimes(1)
    expect(result.narrative).toBe('You shipped the beta this week.')
    expect(result.model).toBe('model-a')
    expect(result.generatedAt).toBeTruthy()
  })

  it('runs a two-pass map-reduce when the period needs more than one chunk', async () => {
    chatCompletion
      .mockResolvedValueOnce(ok('Partial one.'))
      .mockResolvedValueOnce(ok('Partial two.'))
      .mockResolvedValueOnce(ok('The combined paragraph.'))

    const result = await generatePeriodNarrative({
      periodType: 'quarter',
      days: [dayWith(1, 3), dayWith(2, 3)],
      maxBeatsPerChunk: 3,
    })

    expect(chatCompletion).toHaveBeenCalledTimes(3)
    expect(result.narrative).toBe('The combined paragraph.')
  })

  it('the reduce call receives only the partial paragraphs, never the raw beats', async () => {
    chatCompletion
      .mockResolvedValueOnce(ok('Partial one.'))
      .mockResolvedValueOnce(ok('Partial two.'))
      .mockResolvedValueOnce(ok('Combined.'))

    await generatePeriodNarrative({
      periodType: 'quarter',
      days: [dayWith(1, 3), dayWith(2, 3)],
      maxBeatsPerChunk: 3,
    })

    const reduceMessages = chatCompletion.mock.calls[2]![0] as Array<{ content: string }>
    expect(reduceMessages[1]!.content).toContain('Partial one.')
    expect(reduceMessages[1]!.content).toContain('Partial two.')
    expect(reduceMessages[1]!.content).not.toContain('beat 1-0')
  })

  it('always returns exactly one paragraph string regardless of chunk count', async () => {
    chatCompletion.mockResolvedValue(ok('One paragraph.'))
    const single = await generatePeriodNarrative({ periodType: 'week', days: [dayWith(1, 2)] })
    expect(typeof single.narrative).toBe('string')

    chatCompletion.mockReset()
    chatCompletion
      .mockResolvedValueOnce(ok('P1.'))
      .mockResolvedValueOnce(ok('P2.'))
      .mockResolvedValueOnce(ok('P3.'))
      .mockResolvedValueOnce(ok('Final.'))
    const multi = await generatePeriodNarrative({
      periodType: 'year',
      days: [dayWith(1, 2), dayWith(2, 2), dayWith(3, 2)],
      maxBeatsPerChunk: 2,
    })
    expect(typeof multi.narrative).toBe('string')
    expect(multi.narrative).toBe('Final.')
  })

  it('advances to the next model when the first call is not ok', async () => {
    chatCompletion
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce(ok('You shipped the beta.'))
    const result = await generatePeriodNarrative({ periodType: 'week', days: [dayWith(1, 3)] })
    expect(result.model).toBe('model-b')
  })

  it('throws when every model fails', async () => {
    chatCompletion.mockResolvedValue({ ok: false, status: 500 })
    await expect(
      generatePeriodNarrative({ periodType: 'week', days: [dayWith(1, 3)] }),
    ).rejects.toThrow()
  })

  it('throws when there are no beats to synthesize', async () => {
    await expect(
      generatePeriodNarrative({ periodType: 'week', days: [dayWith(1, 0)] }),
    ).rejects.toThrow()
    expect(chatCompletion).not.toHaveBeenCalled()
  })

  it('includes the period type and each day\'s beats in the synthesize prompt', async () => {
    chatCompletion.mockResolvedValueOnce(ok('Paragraph.'))
    await generatePeriodNarrative({ periodType: 'month', days: [dayWith(7, 2)] })

    const [system, user] = chatCompletion.mock.calls[0]![0] as Array<{ content: string }>
    expect(system.content).toContain('month')
    expect(user.content).toContain('Day 7')
    expect(user.content).toContain('beat 7-0')
    expect(user.content).toContain('<spine>')
  })
})
