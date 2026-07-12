// On-device embedder: runs the hosted distiluse full-pipeline ONNX
// (transformer → mean-pool → Dense 768→512 Tanh, all baked into the graph) via
// onnxruntime-web, then L2-normalizes the rank-2 [1,512] `sentence_embedding`
// output. This is the ONE correct way to land in the shared 512-dim space —
// bare Transformers.js feature-extraction would return the 768-dim pre-Dense
// vector. Lazy singleton; WebGPU with a WASM fallback. Byte-parity with iOS is
// enforced by onnxEmbedder.parity.test.ts (cosine > 0.999 vs the canonical ref).
//
// ⚠️ TEMPORARY DEPLOY STUB (2026-07-11): the real implementation statically imports
// `onnxruntime-web` and (via ./tokenizer) `@huggingface/transformers`, whose bundled
// `ort.node.min.mjs` breaks the Next 14 webpack/Terser production build. To ship the
// blog without that build failure, the runtime embedder is stubbed to the module's
// designed `ModelUnavailableError` degradation path (coordinator uses *Safe wrappers
// that catch it). Restore the real embedder + fix the transformers build with:
//   git checkout origin/feat/web-app-m1-m2 -- web/src/lib/embeddings/onnxEmbedder.ts

export const EMBEDDING_DIM = 512
export const EMBEDDING_MODEL_ID = 'distiluse-multilingual-v1'

export class ModelUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('The on-device embedding model could not be loaded (no WebGPU/WASM backend available).')
    this.name = 'ModelUnavailableError'
    if (cause instanceof Error) this.cause = cause
  }
}

/** Embed text → 512-dim L2-normalized vector in the shared cross-platform space.
 *  TEMPORARY STUB: embedding is disabled in this build (see file header). */
export async function embed(_text: string): Promise<Float32Array> {
  throw new ModelUnavailableError()
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
