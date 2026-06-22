import { config } from '../config'
import { Readable } from 'stream'

const BASE = 'https://api.together.xyz/v1'

export async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array))
  }
  return Buffer.concat(chunks)
}

export async function transcribeAudio(buffer: Buffer, filename: string): Promise<string> {
  const form = new FormData()
  form.append('model', config.TOGETHER_WHISPER_MODEL)
  form.append('file', new Blob([buffer]), filename)

  const res = await fetch(`${BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.TOGETHER_AI_API_KEY}` },
    body: form,
  })
  if (!res.ok) {
    throw new Error(`Together AI transcribe error ${res.status}: ${await res.text()}`)
  }
  const data = (await res.json()) as { text: string }
  return data.text.trim()
}

/**
 * Embed passages/documents. Inputs are sent verbatim — for the e5 family this
 * is correct (only queries take an instruction; passages stay raw).
 */
export async function embed(texts: string[]): Promise<number[][]> {
  const res = await fetch(`${BASE}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.TOGETHER_AI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: config.TOGETHER_EMBEDDING_MODEL, input: texts }),
  })
  if (!res.ok) {
    throw new Error(`Together AI embed error ${res.status}: ${await res.text()}`)
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
  const isE5Instruct = /e5.*instruct/i.test(config.TOGETHER_EMBEDDING_MODEL)
  const input = isE5Instruct ? `Instruct: ${E5_QUERY_TASK}\nQuery: ${text}` : text
  const [vector] = await embed([input])
  return vector
}

// Default chat model for callers that don't override it (e.g. text chat). Must be
// a serverless model — non-serverless ids (e.g. Llama-4-Maverick) 400 with
// "create a dedicated endpoint". This matches the model the voice (/llm) path uses.
export const DEFAULT_CHAT_MODEL = 'meta-llama/Llama-3.3-70B-Instruct-Turbo'

export async function chatCompletion(
  messages: Array<{ role: string; content: string }>,
  opts: { model?: string; stream?: boolean } = {},
): Promise<Response> {
  const model = opts.model ?? DEFAULT_CHAT_MODEL
  return fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.TOGETHER_AI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, stream: opts.stream ?? false }),
  })
}
