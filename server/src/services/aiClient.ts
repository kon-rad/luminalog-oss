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

export async function chatCompletion(
  messages: Array<{ role: string; content: string }>,
  opts: { model?: string; stream?: boolean } = {},
): Promise<Response> {
  const model = opts.model ?? 'meta-llama/Llama-3.3-70B-Instruct-Turbo'
  return fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.TOGETHER_AI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, stream: opts.stream ?? false }),
  })
}
