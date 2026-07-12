import { describe, it, expect, vi, beforeEach } from 'vitest'
import { transcribeAudio, transcribeWithDeepgram } from '../services/aiClient'
import { deepgramEnabled } from '../config'
import { transcribeClipHandler } from './transcribeClip'

vi.mock('../services/aiClient', () => ({ transcribeAudio: vi.fn(), transcribeWithDeepgram: vi.fn() }))
vi.mock('../config', () => ({ deepgramEnabled: vi.fn(() => false) }))

function mockRes() {
  const res: any = { statusCode: 200 }
  res.status = vi.fn((c: number) => { res.statusCode = c; return res })
  res.json = vi.fn((b: any) => { res.body = b; return res })
  return res
}

describe('transcribeClipHandler', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns transcript text for a valid audio body', async () => {
    ;(transcribeAudio as any).mockResolvedValue('hello world')
    const req: any = { body: Buffer.from('fake-audio') }
    const res = mockRes()
    await transcribeClipHandler(req, res)
    expect(transcribeAudio).toHaveBeenCalledOnce()
    expect(res.body).toEqual({ text: 'hello world' })
  })

  it('returns 400 on empty body', async () => {
    const req: any = { body: Buffer.alloc(0) }
    const res = mockRes()
    await transcribeClipHandler(req, res)
    expect(res.statusCode).toBe(400)
    expect(transcribeAudio).not.toHaveBeenCalled()
  })

  it('returns 500 when transcription fails', async () => {
    ;(transcribeAudio as any).mockRejectedValue(new Error('whisper down'))
    const req: any = { body: Buffer.from('x') }
    const res = mockRes()
    await transcribeClipHandler(req, res)
    expect(res.statusCode).toBe(500)
  })

  it('uses Deepgram when enabled and returns its transcript', async () => {
    ;(deepgramEnabled as any).mockReturnValue(true)
    ;(transcribeWithDeepgram as any).mockResolvedValue('deepgram text')
    const req: any = { body: Buffer.from('audio'), headers: { 'content-type': 'audio/m4a' } }
    const res = mockRes()
    await transcribeClipHandler(req, res)
    expect(transcribeWithDeepgram).toHaveBeenCalledOnce()
    expect(transcribeAudio).not.toHaveBeenCalled()
    expect(res.body).toEqual({ text: 'deepgram text' })
  })

  it('falls back to Whisper when Deepgram errors', async () => {
    ;(deepgramEnabled as any).mockReturnValue(true)
    ;(transcribeWithDeepgram as any).mockRejectedValue(new Error('deepgram down'))
    ;(transcribeAudio as any).mockResolvedValue('whisper text')
    const req: any = { body: Buffer.from('audio'), headers: { 'content-type': 'audio/m4a' } }
    const res = mockRes()
    await transcribeClipHandler(req, res)
    expect(transcribeWithDeepgram).toHaveBeenCalledOnce()
    expect(transcribeAudio).toHaveBeenCalledOnce()
    expect(res.body).toEqual({ text: 'whisper text' })
  })
})
