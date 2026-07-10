// On-device embedder: runs the hosted distiluse full-pipeline ONNX
// (transformer → mean-pool → Dense 768→512 Tanh, all baked into the graph) via
// onnxruntime-web, then L2-normalizes the rank-2 [1,512] `sentence_embedding`
// output. This is the ONE correct way to land in the shared 512-dim space —
// bare Transformers.js feature-extraction would return the 768-dim pre-Dense
// vector. Lazy singleton; WebGPU with a WASM fallback. Byte-parity with iOS is
// enforced by onnxEmbedder.parity.test.ts (cosine > 0.999 vs the canonical ref).

import * as ort from 'onnxruntime-web'
import { fetchAsset } from '@/lib/embeddings/modelProvider'
import { tokenize } from '@/lib/embeddings/tokenizer'

export const EMBEDDING_DIM = 512
export const EMBEDDING_MODEL_ID = 'distiluse-multilingual-v1'

export class ModelUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('The on-device embedding model could not be loaded (no WebGPU/WASM backend available).')
    this.name = 'ModelUnavailableError'
    if (cause instanceof Error) this.cause = cause
  }
}

let sessionPromise: Promise<ort.InferenceSession> | null = null

async function createSession(bytes: ArrayBuffer): Promise<ort.InferenceSession> {
  // Prefer WebGPU (fast) and fall back to WASM. Some environments reject an
  // unavailable provider in the list rather than skipping it, so try each.
  for (const ep of ['webgpu', 'wasm'] as const) {
    try {
      return await ort.InferenceSession.create(bytes, { executionProviders: [ep] })
    } catch {
      // try the next provider
    }
  }
  throw new ModelUnavailableError()
}

async function getSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const bytes = await fetchAsset('onnx')
      return createSession(bytes)
    })().catch((err) => {
      sessionPromise = null // failures are retryable — don't cache them
      throw err instanceof ModelUnavailableError ? err : new ModelUnavailableError(err)
    })
  }
  return sessionPromise
}

function l2normalize(v: Float32Array): Float32Array {
  let mag = 0
  for (let i = 0; i < v.length; i++) mag += v[i] * v[i]
  mag = Math.sqrt(mag)
  const out = new Float32Array(v.length)
  if (mag === 0) return out
  for (let i = 0; i < v.length; i++) out[i] = v[i] / mag
  return out
}

/** Embed text → 512-dim L2-normalized vector in the shared cross-platform space. */
export async function embed(text: string): Promise<Float32Array> {
  const session = await getSession()
  const { inputIds, attentionMask } = await tokenize(text)
  const len = inputIds.length
  const feeds: Record<string, ort.Tensor> = {
    input_ids: new ort.Tensor('int64', inputIds, [1, len]),
    attention_mask: new ort.Tensor('int64', attentionMask, [1, len]),
  }
  const results = await session.run(feeds)
  const output = results[session.outputNames[0]]
  const data = output.data as Float32Array
  if (data.length !== EMBEDDING_DIM) {
    throw new Error(`Embedder produced ${data.length} dims, expected ${EMBEDDING_DIM}`)
  }
  return l2normalize(Float32Array.from(data))
}

/** Cosine similarity of two vectors. For L2-normalized inputs this is the dot product. */
export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0
  let ma = 0
  let mb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    ma += a[i] * a[i]
    mb += b[i] * b[i]
  }
  const denom = Math.sqrt(ma) * Math.sqrt(mb)
  return denom === 0 ? 0 : dot / denom
}
