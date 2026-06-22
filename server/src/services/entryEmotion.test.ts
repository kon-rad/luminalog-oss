import { vi, describe, it, expect, beforeEach } from 'vitest'

const scoreText = vi.fn()
const scoreAudio = vi.fn()
vi.mock('./humeService', () => ({
  scoreText: (...a: any[]) => scoreText(...a),
  scoreAudio: (...a: any[]) => scoreAudio(...a),
  topN: (s: Record<string, number>, n: number) =>
    Object.entries(s).map(([name, score]) => ({ name, score })).sort((a, b) => b.score - a.score).slice(0, n),
}))
const update = vi.fn(async () => {})
vi.mock('../middleware/firebaseAuth', () => ({
  db: { collection: () => ({ doc: () => ({ update }) }) },
}))
vi.mock('./s3', () => ({}))

import { scoreEntryEmotion } from './entryEmotion'

const baseArgs = () => ({
  uid: 'u', journalId: 'j', content: 'I felt calm and happy today.',
  data: { media: [] } as any,
  downloadAudio: vi.fn(),
})

beforeEach(() => { scoreText.mockReset(); scoreAudio.mockReset(); update.mockReset() })

describe('scoreEntryEmotion', () => {
  it('writes a text-source emotion when there is no media', async () => {
    scoreText.mockResolvedValue({ scores: { Joy: 0.8, Calmness: 0.6 }, top: [] })
    await scoreEntryEmotion(baseArgs())
    expect(scoreAudio).not.toHaveBeenCalled()
    const payload = (update.mock.calls as any[][])[0][0]
    expect(payload.emotion.source).toBe('text')
    expect(payload.emotion.scores.Joy).toBe(0.8)
    expect(payload.emotion.top[0]).toEqual({ name: 'Joy', score: 0.8 })
  })

  it('merges audio prosody for voice entries', async () => {
    scoreText.mockResolvedValue({ scores: { Joy: 0.4 }, top: [] })
    scoreAudio.mockResolvedValue({ scores: { Calmness: 0.9 }, top: [] })
    const args = baseArgs()
    args.data = { media: [{ s3Key: 'k', kind: 'audio' }] }
    args.downloadAudio = vi.fn(async () => Buffer.from('x'))
    await scoreEntryEmotion(args)
    const payload = (update.mock.calls as any[][])[0][0]
    expect(payload.emotion.source).toBe('text+audio')
    expect(payload.emotion.scores.Calmness).toBe(0.9)
  })

  it('does not write and never throws when scoring yields nothing', async () => {
    scoreText.mockResolvedValue(null)
    await expect(scoreEntryEmotion(baseArgs())).resolves.toBeUndefined()
    expect(update).not.toHaveBeenCalled()
  })

  it('skips when emotion already present and not forced', async () => {
    const args = baseArgs(); args.data = { media: [], emotion: { source: 'text' } }
    await scoreEntryEmotion(args)
    expect(scoreText).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('scores audio-only when text yields nothing', async () => {
    scoreText.mockResolvedValue(null)
    scoreAudio.mockResolvedValue({ scores: { Calmness: 0.7 }, top: [] })
    const args = baseArgs()
    args.data = { media: [{ s3Key: 'k', kind: 'audio' }] }
    args.downloadAudio = vi.fn(async () => Buffer.from('x'))
    await scoreEntryEmotion(args)
    const payload = (update.mock.calls as any[][])[0][0]
    expect(payload.emotion.source).toBe('audio')
    expect(payload.emotion.scores.Calmness).toBe(0.7)
  })

  it('averages overlapping emotion keys across text and audio', async () => {
    scoreText.mockResolvedValue({ scores: { Joy: 0.4 }, top: [] })
    scoreAudio.mockResolvedValue({ scores: { Joy: 0.8 }, top: [] })
    const args = baseArgs()
    args.data = { media: [{ s3Key: 'k', kind: 'video' }] }
    args.downloadAudio = vi.fn(async () => Buffer.from('x'))
    await scoreEntryEmotion(args)
    const payload = (update.mock.calls as any[][])[0][0]
    expect(payload.emotion.scores.Joy).toBeCloseTo(0.6)
  })

  it('re-scores when force is true even if emotion already present', async () => {
    scoreText.mockResolvedValue({ scores: { Joy: 0.5 }, top: [] })
    const args = baseArgs()
    args.data = { media: [], emotion: { source: 'text' } }
    ;(args as any).force = true
    await scoreEntryEmotion(args)
    expect(scoreText).toHaveBeenCalled()
    expect(update).toHaveBeenCalledTimes(1)
  })
})
