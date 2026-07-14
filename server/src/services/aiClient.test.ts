import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Mock config so importing aiClient doesn't trigger env validation / process.exit.
// The `config` object is mutable so provider-switch tests can toggle AI_PROVIDER etc.
vi.mock('../config', () => {
  const config: any = {
    TOGETHER_AI_API_KEY: 'k',
    TOGETHER_EMBEDDING_MODEL: 'togethercomputer/m2-bert-80M-8k-retrieval',
    TOGETHER_WHISPER_MODEL: 'whisper',
    DEEPGRAM_API_KEY: 'dk',
    DEEPGRAM_MODEL: 'nova-3',
  }
  return { config }
})

import { config } from '../config'
import {
  fetchWithRetry,
  chatCompletion,
  resolveProviders,
  transcribeAudio,
  transcribeWithDeepgram,
} from './aiClient'

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

  // Reliability: Together's serverless Whisper intermittently 429/500s under load.
  // The call must retry transiently (a fresh FormData per attempt — the body is
  // single-use once streamed) instead of surfacing a one-off blip as a failure.
  it('retries a transient 429 then succeeds, rebuilding the multipart body each attempt', async () => {
    const transient = { status: 429, ok: false, body: { cancel: vi.fn(async () => {}) }, text: async () => 'busy' } as any
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(transient)
      .mockResolvedValueOnce(jsonResp({ text: 'full transcript', segments: [] }))
    vi.stubGlobal('fetch', fetchMock)

    const out = await transcribeAudio(Buffer.from('audio'), 'clip.m4a', { sleep: noSleep })

    expect(out).toBe('full transcript')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    // Each attempt gets its own valid FormData (not a reused, already-consumed one).
    for (const call of fetchMock.mock.calls) {
      const body = call[1].body as FormData
      expect(body.get('model')).toBe('whisper')
      expect(body.get('response_format')).toBe('verbose_json')
    }
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

  // A 401 is a request problem (bad key) and must NOT be retried — but a 502/503/504
  // under load is transient and should retry before falling back to Whisper.
  it('retries a transient 503 then succeeds', async () => {
    const transient = { status: 503, ok: false, body: { cancel: vi.fn(async () => {}) }, text: async () => 'unavailable' } as any
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(transient)
      .mockResolvedValueOnce(jsonResp({
        results: { channels: [{ alternatives: [{ transcript: 'recovered' }] }] },
      }))
    vi.stubGlobal('fetch', fetchMock)

    const out = await transcribeWithDeepgram(Buffer.from('audio'), 'audio/m4a', { sleep: noSleep })

    expect(out).toBe('recovered')
    expect(fetchMock).toHaveBeenCalledTimes(2)
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

// --- Provider switch (ADR-0085/0087) — single active provider, NO fallback --------
// These mutate the shared mocked `config`; reset the switch fields after each.
function resetProviderConfig() {
  const c = config as any
  c.AI_PROVIDER = undefined
  c.MORPHEUS_API_KEY = undefined
  c.MORPHEUS_BASE_URL = undefined
  c.MORPHEUS_CHAT_MODEL = undefined
}

describe('resolveProviders', () => {
  beforeEach(resetProviderConfig)
  afterEach(resetProviderConfig)

  it('resolves Together when AI_PROVIDER is unset', () => {
    const { primary } = resolveProviders()
    expect(primary.name).toBe('together')
    expect(primary.baseUrl).toContain('together.xyz')
  })

  it('resolves Morpheus as the active provider when AI_PROVIDER=morpheus', () => {
    config.AI_PROVIDER = 'morpheus'
    config.MORPHEUS_API_KEY = 'mk'
    config.MORPHEUS_CHAT_MODEL = 'claude-opus-4.8'
    const { primary } = resolveProviders()
    expect(primary.name).toBe('morpheus')
    expect(primary.apiKey).toBe('mk')
    expect(primary.chatModel).toBe('claude-opus-4.8')
  })
})

describe('chatCompletion (single provider, no fallback)', () => {
  beforeEach(() => { vi.unstubAllGlobals(); resetProviderConfig() })
  afterEach(resetProviderConfig)

  it('hits the active provider (Morpheus) and returns its response', async () => {
    config.AI_PROVIDER = 'morpheus'
    config.MORPHEUS_API_KEY = 'mk'
    const fetchMock = vi.fn().mockResolvedValueOnce(resp(200))
    vi.stubGlobal('fetch', fetchMock)

    const res = await chatCompletion([{ role: 'user', content: 'hi' }])

    expect(res.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain('mor.org')
  })

  it('does NOT fall back to Together on a non-ok Morpheus response', async () => {
    config.AI_PROVIDER = 'morpheus'
    config.MORPHEUS_API_KEY = 'mk'
    // Morpheus exhausts its retries with 500s; the 500 is returned as-is — Together is never called.
    const fetchMock = vi.fn().mockResolvedValue(resp(500))
    vi.stubGlobal('fetch', fetchMock)

    const res = await chatCompletion([{ role: 'user', content: 'hi' }])

    expect(res.status).toBe(500)
    for (const call of fetchMock.mock.calls) {
      expect(call[0]).toContain('mor.org')
      expect(call[0]).not.toContain('together.xyz')
    }
  })

  it('throws when the active provider has no API key', async () => {
    config.AI_PROVIDER = 'morpheus' // no MORPHEUS_API_KEY
    await expect(chatCompletion([{ role: 'user', content: 'hi' }])).rejects.toThrow(/no API key/)
  })
})
