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
  return {
    config,
    togetherFallbackEnabled: () => {
      const v = String(config.AI_FALLBACK_TO_TOGETHER ?? '').trim().toLowerCase()
      return v === '1' || v === 'true' || v === 'yes' || v === 'on'
    },
  }
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

// --- Provider switch (ADR-0085) -------------------------------------------------
// These mutate the shared mocked `config`; reset the switch fields after each.
function resetProviderConfig() {
  const c = config as any
  c.AI_PROVIDER = undefined
  c.AI_FALLBACK_TO_TOGETHER = undefined
  c.MORPHEUS_API_KEY = undefined
  c.MORPHEUS_BASE_URL = undefined
  c.MORPHEUS_CHAT_MODEL = undefined
}

describe('resolveProviders', () => {
  beforeEach(resetProviderConfig)
  afterEach(resetProviderConfig)

  it('defaults to Together with no fallback', () => {
    const { primary, fallback } = resolveProviders()
    expect(primary.name).toBe('together')
    expect(primary.baseUrl).toContain('together.xyz')
    expect(fallback).toBeUndefined()
  })

  it('selects Morpheus as primary when AI_PROVIDER=morpheus', () => {
    config.AI_PROVIDER = 'morpheus'
    config.MORPHEUS_API_KEY = 'mk'
    config.MORPHEUS_BASE_URL = 'https://api.mor.org/api/v1'
    config.MORPHEUS_CHAT_MODEL = 'llama-3.3-70b'
    const { primary, fallback } = resolveProviders()
    expect(primary.name).toBe('morpheus')
    expect(primary.apiKey).toBe('mk')
    expect(primary.chatModel).toBe('llama-3.3-70b')
    // Fallback OFF by default, even with a Together key present.
    expect(fallback).toBeUndefined()
  })

  it('adds a Together fallback only when AI_FALLBACK_TO_TOGETHER is on', () => {
    config.AI_PROVIDER = 'morpheus'
    config.MORPHEUS_API_KEY = 'mk'
    config.AI_FALLBACK_TO_TOGETHER = '1'
    const { primary, fallback } = resolveProviders()
    expect(primary.name).toBe('morpheus')
    expect(fallback?.name).toBe('together')
  })

  it('never adds a fallback when the active provider is already Together', () => {
    config.AI_FALLBACK_TO_TOGETHER = 'true'
    const { fallback } = resolveProviders()
    expect(fallback).toBeUndefined()
  })
})

describe('chatCompletion provider fallback', () => {
  beforeEach(() => { vi.unstubAllGlobals(); resetProviderConfig() })
  afterEach(resetProviderConfig)

  it('falls back to Together when the Morpheus primary fails, and reports ok', async () => {
    config.AI_PROVIDER = 'morpheus'
    config.MORPHEUS_API_KEY = 'mk'
    config.AI_FALLBACK_TO_TOGETHER = '1'
    // Morpheus exhausts its 3 retry attempts with 500s, then Together answers 200.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(500))
      .mockResolvedValueOnce(resp(500))
      .mockResolvedValueOnce(resp(500))
      .mockResolvedValueOnce(resp(200))
    vi.stubGlobal('fetch', fetchMock)

    const res = await chatCompletion([{ role: 'user', content: 'hi' }])

    expect(res.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    // First 3 calls hit Morpheus; the successful 4th hits Together.
    expect(fetchMock.mock.calls[0][0]).toContain('mor.org')
    expect(fetchMock.mock.calls[3][0]).toContain('together.xyz')
  })

  it('throws when Morpheus has no key and fallback is disabled (no boot crash, call-time error)', async () => {
    config.AI_PROVIDER = 'morpheus'
    // no MORPHEUS_API_KEY, no fallback → empty provider chain
    await expect(chatCompletion([{ role: 'user', content: 'hi' }])).rejects.toThrow(/no usable AI provider/)
  })
})
