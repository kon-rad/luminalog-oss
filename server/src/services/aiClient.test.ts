import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock config so importing aiClient doesn't trigger env validation / process.exit.
vi.mock('../config', () => ({
  config: {
    TOGETHER_AI_API_KEY: 'k',
    TOGETHER_EMBEDDING_MODEL: 'togethercomputer/m2-bert-80M-8k-retrieval',
    TOGETHER_WHISPER_MODEL: 'whisper',
    DEEPGRAM_API_KEY: 'dk',
    DEEPGRAM_MODEL: 'nova-3',
  },
}))

import { fetchWithRetry, chatCompletion, transcribeAudio, transcribeWithDeepgram } from './aiClient'

const noSleep = async () => {}

// Minimal Response-shaped stub. `body.cancel` lets fetchWithRetry drain a
// discarded transient response without a real ReadableStream.
function resp(status: number) {
  return {
    status,
    ok: status >= 200 && status < 300,
    body: { cancel: vi.fn(async () => {}) },
  } as any
}

describe('fetchWithRetry', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  it('retries a transient 503 then returns the eventual 200', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(503))
      .mockResolvedValueOnce(resp(200))
    vi.stubGlobal('fetch', fetchMock)

    const res = await fetchWithRetry('https://x', { method: 'POST' }, { sleep: noSleep })

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does NOT retry a non-transient 400', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(resp(400))
    vi.stubGlobal('fetch', fetchMock)

    const res = await fetchWithRetry('https://x', {}, { sleep: noSleep })

    expect(res.status).toBe(400)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries a thrown network error then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(resp(200))
    vi.stubGlobal('fetch', fetchMock)

    const res = await fetchWithRetry('https://x', {}, { sleep: noSleep })

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gives up after maxAttempts and returns the last transient response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(503))
    vi.stubGlobal('fetch', fetchMock)

    const res = await fetchWithRetry('https://x', {}, { sleep: noSleep, attempts: 3 })

    expect(res.status).toBe(503)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('passes an AbortSignal so a hung request can time out', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(resp(200))
    vi.stubGlobal('fetch', fetchMock)

    await fetchWithRetry('https://x', {}, { sleep: noSleep })

    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })
})

describe('transcribeAudio', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  function jsonResp(payload: any) {
    return { status: 200, ok: true, json: async () => payload, text: async () => '' } as any
  }

  // Regression: Together's default `json` format returns only one chunk's text
  // for paused/chunked audio, truncating multi-minute voice memos to ~40-80
  // words. We must request `verbose_json` to get the full transcript.
  it('requests verbose_json (with model before file) so paused audio is not truncated', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResp({ text: 'full transcript', segments: [] }))
    vi.stubGlobal('fetch', fetchMock)

    const out = await transcribeAudio(Buffer.from('audio'), 'clip.m4a')

    expect(out).toBe('full transcript')
    const body = fetchMock.mock.calls[0][1].body as FormData
    expect(body.get('response_format')).toBe('verbose_json')
    expect(body.get('model')).toBe('whisper')
  })

  it('falls back to concatenating segments when top-level text is missing', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResp({
      segments: [{ text: 'part one ' }, { text: ' part two' }],
    }))
    vi.stubGlobal('fetch', fetchMock)

    const out = await transcribeAudio(Buffer.from('a'), 'c.m4a')

    expect(out).toBe('part one part two')
  })
})

describe('transcribeWithDeepgram', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  function jsonResp(payload: any) {
    return { status: 200, ok: true, json: async () => payload, text: async () => '' } as any
  }

  it('POSTs to Deepgram with the model + Token auth and returns the transcript', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResp({
      results: { channels: [{ alternatives: [{ transcript: 'the full entry' }] }] },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const out = await transcribeWithDeepgram(Buffer.from('audio'), 'audio/m4a')

    expect(out).toBe('the full entry')
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('api.deepgram.com/v1/listen')
    expect(String(url)).toContain('model=nova-3')
    expect(init.headers.Authorization).toBe('Token dk')
    // m4a is normalized to the container MIME Deepgram expects.
    expect(init.headers['Content-Type']).toBe('audio/mp4')
  })

  it('throws on a non-2xx so the caller can fall back to Whisper', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ status: 401, ok: false, text: async () => 'bad key' } as any)
    vi.stubGlobal('fetch', fetchMock)

    await expect(transcribeWithDeepgram(Buffer.from('a'), 'audio/mp4')).rejects.toThrow(/Deepgram transcribe error 401/)
  })
})

describe('chatCompletion transient resilience', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  it('survives a 503-then-200 from Together and returns the ok response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(503))
      .mockResolvedValueOnce(resp(200))
    vi.stubGlobal('fetch', fetchMock)

    const res = await chatCompletion([{ role: 'user', content: 'hi' }], { stream: true })

    expect(res.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
