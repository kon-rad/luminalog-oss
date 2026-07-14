import { config } from '../config'
import { Readable } from 'stream'

// Together's REST base. Transcription (Whisper) stays pinned here regardless of
// AI_PROVIDER — Morpheus has no speech-to-text endpoint (ADR-0085).
const TOGETHER_BASE = 'https://api.together.xyz/v1'

// Defaults mirror the Zod defaults in config.ts, but are duplicated here so the
// provider resolver is robust even when a test mocks `config` with a partial object.
const DEFAULT_TOGETHER_CHAT_MODEL = 'meta-llama/Llama-3.3-70B-Instruct-Turbo'
const DEFAULT_TOGETHER_EMBEDDING_MODEL = 'intfloat/multilingual-e5-large-instruct'
const DEFAULT_MORPHEUS_BASE = 'https://api.mor.org/api/v1'
const DEFAULT_MORPHEUS_CHAT_MODEL = 'llama-3.3-70b'
const DEFAULT_MORPHEUS_EMBEDDING_MODEL = 'text-embedding-bge-m3'

export type AiProviderName = 'together' | 'morpheus'
export interface AiProvider {
  name: AiProviderName
  baseUrl: string
  apiKey: string
  chatModel: string
  embeddingModel: string
}

function togetherProvider(): AiProvider {
  return {
    name: 'together',
    baseUrl: TOGETHER_BASE,
    apiKey: config.TOGETHER_AI_API_KEY ?? '',
    chatModel: config.TOGETHER_CHAT_MODEL ?? DEFAULT_TOGETHER_CHAT_MODEL,
    embeddingModel: config.TOGETHER_EMBEDDING_MODEL ?? DEFAULT_TOGETHER_EMBEDDING_MODEL,
  }
}

function morpheusProvider(): AiProvider {
  return {
    name: 'morpheus',
    baseUrl: config.MORPHEUS_BASE_URL ?? DEFAULT_MORPHEUS_BASE,
    apiKey: config.MORPHEUS_API_KEY ?? '',
    chatModel: config.MORPHEUS_CHAT_MODEL ?? DEFAULT_MORPHEUS_CHAT_MODEL,
    embeddingModel: config.MORPHEUS_EMBEDDING_MODEL ?? DEFAULT_MORPHEUS_EMBEDDING_MODEL,
  }
}

/**
 * The single active provider selected by AI_PROVIDER. There is NO cross-provider
 * fallback — a failed call is retried against the SAME provider (`fetchWithRetry`)
 * and then surfaced. Returns a `{ primary }` shape so existing callers keep working.
 */
export function resolveProviders(): { primary: AiProvider } {
  const name: AiProviderName = config.AI_PROVIDER === 'morpheus' ? 'morpheus' : 'together'
  const primary = name === 'morpheus' ? morpheusProvider() : togetherProvider()
  return { primary }
}

/** The model id generations are tagged with (stored on the entry's AI metadata). */
export function activeChatModel(): string {
  return resolveProviders().primary.chatModel
}

// Together's serverless endpoints intermittently return these under load. They
// are explicitly retryable ("busy, ask again") — unlike 4xx (e.g. 400) which is
// a request problem and must NOT be retried.
const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504])
const RETRY_ATTEMPTS = 3
const RETRY_BASE_BACKOFF_MS = 250
const REQUEST_TIMEOUT_MS = 30_000
// Transcription runs Whisper/Deepgram over a whole recording, which legitimately
// takes far longer than a chat turn — a multi-minute voice memo can exceed 30 s.
// Use a generous per-attempt bound so a slow-but-working transcription isn't
// aborted and turned into a spurious failure.
const TRANSCRIBE_TIMEOUT_MS = 120_000

const defaultSleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

/**
 * fetch() hardened against transient upstream failures. Retries transient HTTP
 * statuses and thrown network/abort errors with exponential backoff, and bounds
 * each attempt with an AbortController timeout so a hung connection can't stall
 * the caller (critical for the live voice /llm turn). The timeout is cleared once
 * the response returns, so it bounds time-to-response, never a legitimate stream.
 * On give-up it returns the last transient Response (or rethrows the last error).
 */
export interface RetryOpts {
  attempts?: number
  baseBackoffMs?: number
  timeoutMs?: number
  sleep?: (ms: number) => Promise<void>
}

export async function fetchWithRetry(
  url: string,
  // Either a static init or a factory that rebuilds it per attempt. A factory is
  // REQUIRED when the body is single-use once streamed (multipart FormData, a Blob,
  // or any stream) — reusing a consumed body on retry throws "body already used".
  init: RequestInit | (() => RequestInit),
  opts: RetryOpts = {},
): Promise<Response> {
  const attempts = opts.attempts ?? RETRY_ATTEMPTS
  const baseBackoff = opts.baseBackoffMs ?? RETRY_BASE_BACKOFF_MS
  const timeoutMs = opts.timeoutMs ?? REQUEST_TIMEOUT_MS
  const sleep = opts.sleep ?? defaultSleep
  const resolveInit = typeof init === 'function' ? init : () => init

  let lastErr: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...resolveInit(), signal: controller.signal })
      if (TRANSIENT_STATUSES.has(res.status) && attempt < attempts) {
        // Drain the discarded body so the connection can be reused/freed.
        await res.body?.cancel().catch(() => {})
        await sleep(baseBackoff * 2 ** (attempt - 1))
        continue
      }
      return res
    } catch (err) {
      lastErr = err
      if (attempt >= attempts) throw err
      await sleep(baseBackoff * 2 ** (attempt - 1))
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastErr ?? new Error('fetchWithRetry: exhausted attempts')
}

export async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array))
  }
  return Buffer.concat(chunks)
}

type WhisperSegment = { text?: string }
type WhisperResponse = { text?: string; segments?: WhisperSegment[]; duration?: number }

export async function transcribeAudio(
  buffer: Buffer,
  filename: string,
  opts: RetryOpts = {},
): Promise<string> {
  // Build a FRESH FormData per attempt: the multipart body is streamed and thus
  // single-use, so a retry must not reuse the already-consumed one.
  const makeInit = (): RequestInit => {
    const form = new FormData()
    // `model` MUST precede `file` so Together can dispatch the upload without
    // buffering the whole payload (per Together's API guidance).
    form.append('model', config.TOGETHER_WHISPER_MODEL)
    // `verbose_json` is required for CORRECTNESS, not just extra detail. With the
    // default `json` format, Together's Whisper returns only a SINGLE chunk's text
    // for any audio it internally splits into chunks — which happens whenever a
    // recording contains pauses/silence (i.e. essentially every real voice memo).
    // The rest is silently dropped, so a multi-minute entry comes back as ~40-80
    // words. `verbose_json` returns every segment, yielding the full transcript.
    // (Reproduced against whisper-large-v3: a 103s clip with pauses returned 81
    // words as `json` vs the full 180 words as `verbose_json`.)
    form.append('response_format', 'verbose_json')
    form.append('file', new Blob([buffer]), filename)
    return {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.TOGETHER_AI_API_KEY}` },
      body: form,
    }
  }

  // Retry transient 429/5xx + network/timeout blips (Together's serverless Whisper
  // returns these under load) before surfacing a failure to the caller.
  const res = await fetchWithRetry(`${TOGETHER_BASE}/audio/transcriptions`, makeInit, {
    timeoutMs: TRANSCRIBE_TIMEOUT_MS,
    ...opts,
  })
  if (!res.ok) {
    throw new Error(`Together AI transcribe error ${res.status}: ${await res.text()}`)
  }
  const data = (await res.json()) as WhisperResponse
  // Prefer the top-level text (verbose_json concatenates all segments into it);
  // fall back to stitching segments if a future API shape ever omits it. Either
  // way we keep the WHOLE transcript, never a single chunk.
  const fromText = (data.text ?? '').trim()
  const fromSegments = (data.segments ?? [])
    .map(s => (s.text ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .trim()
  const transcript = fromText.length >= fromSegments.length ? fromText : fromSegments

  // Lightweight observability so any future truncation is visible in logs:
  // compare audio length against words returned (a tiny ratio = a regression).
  const words = transcript ? transcript.split(/\s+/).length : 0
  console.log(`[transcribeAudio] duration=${data.duration ?? '?'}s words=${words}`)

  return transcript
}

type DeepgramResponse = {
  results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string }> }> }
}

/**
 * Transcribe a recorded clip with Deepgram's pre-recorded API (used for voice/
 * video journal entries — higher accuracy than Whisper on real recordings).
 * Sends the raw audio bytes with their Content-Type; `smart_format` adds
 * punctuation/casing. Throws on a non-2xx so the caller can fall back to Whisper.
 */
export async function transcribeWithDeepgram(
  buffer: Buffer,
  contentType = 'audio/m4a',
  opts: RetryOpts = {},
): Promise<string> {
  if (!config.DEEPGRAM_API_KEY) throw new Error('Deepgram not configured')
  // Normalize the m4a container to the MIME Deepgram expects; pass others through.
  const mime = contentType === 'audio/m4a' ? 'audio/mp4' : contentType
  const params = new URLSearchParams({ model: config.DEEPGRAM_MODEL, smart_format: 'true', punctuate: 'true' })

  // Retry transient 429/5xx + network/timeout blips before throwing (which lets the
  // caller fall back to Whisper only on a genuine, non-transient Deepgram failure).
  const res = await fetchWithRetry(`https://api.deepgram.com/v1/listen?${params.toString()}`, () => ({
    method: 'POST',
    headers: { Authorization: `Token ${config.DEEPGRAM_API_KEY}`, 'Content-Type': mime },
    body: buffer,
  }), { timeoutMs: TRANSCRIBE_TIMEOUT_MS, ...opts })
  if (!res.ok) {
    throw new Error(`Deepgram transcribe error ${res.status}: ${await res.text()}`)
  }
  const data = (await res.json()) as DeepgramResponse
  const transcript = (data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '').trim()
  const words = transcript ? transcript.split(/\s+/).length : 0
  console.log(`[transcribeDeepgram] model=${config.DEEPGRAM_MODEL} words=${words}`)
  return transcript
}

/**
 * Embed passages/documents. Inputs are sent verbatim — for the e5 family this
 * is correct (only queries take an instruction; passages stay raw).
 */
export async function embed(texts: string[]): Promise<number[][]> {
  // Dormant path (no live caller today). Routes through the active provider so a
  // future reactivation follows AI_PROVIDER. NOTE: Morpheus BGE-M3 is 1024-dim vs
  // the on-device 512-dim index — reactivating on Morpheus is an index-breaking
  // project, not a drop-in (ADR-0085).
  const p = resolveProviders().primary
  const res = await fetchWithRetry(`${p.baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${p.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: p.embeddingModel, input: texts }),
  })
  if (!res.ok) {
    throw new Error(`${p.name} embed error ${res.status}: ${await res.text()}`)
  }
  const data = (await res.json()) as { data: Array<{ embedding: number[]; index: number }> }
  return data.data.sort((a, b) => a.index - b.index).map(d => d.embedding)
}

const E5_QUERY_TASK = 'Given a journal search query, retrieve the relevant past journal entries'

/**
 * Embed a retrieval query. e5-instruct models are trained to receive queries
 * wrapped as `Instruct: <task>\nQuery: <text>` (passages stay raw); applying it
 * only when the configured model is an e5-instruct keeps this a no-op for other
 * models. Query and passage embeddings must come from the same model to compare.
 */
export async function embedQuery(text: string): Promise<number[]> {
  const isE5Instruct = /e5.*instruct/i.test(resolveProviders().primary.embeddingModel)
  const input = isE5Instruct ? `Instruct: ${E5_QUERY_TASK}\nQuery: ${text}` : text
  const [vector] = await embed([input])
  return vector
}

/**
 * OpenAI-compatible chat completion against the single active provider (AI_PROVIDER).
 * NO cross-provider fallback: transient failures are retried against the SAME provider
 * by `fetchWithRetry`, then the response (ok or not) is returned to the caller. The
 * model defaults to the provider's configured chat model (`opts.model` overrides it).
 */
export async function chatCompletion(
  messages: Array<{ role: string; content: string }>,
  opts: { model?: string; stream?: boolean; response_format?: { type: string } } = {},
): Promise<Response> {
  const p = resolveProviders().primary
  if (!p.apiKey) {
    throw new Error(
      `chatCompletion: no API key for AI_PROVIDER=${config.AI_PROVIDER ?? 'together'}`,
    )
  }
  const model = opts.model ?? p.chatModel
  const body: Record<string, unknown> = { model, messages, stream: opts.stream ?? false }
  if (opts.response_format) body.response_format = opts.response_format
  return fetchWithRetry(`${p.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${p.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}
