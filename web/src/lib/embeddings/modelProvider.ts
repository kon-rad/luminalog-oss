// Downloads, integrity-verifies, and caches the on-device embedding model assets
// (the distiluse-base-multilingual-cased-v2 ONNX + its two WordPiece tokenizer
// JSON files). Mirrors the iOS `EmbeddingModelProvider`: fetch from a pinned,
// versioned URL, verify SHA-256, cache; serve from cache when the hash matches
// (no network); never cache bad bytes. The pinned hashes are the parity anchor —
// a byte-different model would silently drift the shared 512-dim vector space.

export const MODEL_BASE =
  'https://luminalog-models.s3.us-east-1.amazonaws.com/distiluse-multilingual/v1'

export type ModelAssetKey = 'onnx' | 'tokenizer' | 'tokenizerConfig'

export interface ModelAsset {
  key: ModelAssetKey
  url: string
  sha256: string
}

export const MODEL_ASSETS: ModelAsset[] = [
  {
    key: 'onnx',
    url: `${MODEL_BASE}/distiluse-multilingual.onnx`,
    sha256: 'ef4f58f1eb478e3097c3b4f197c97390ae4decaedc363defbb937a4c8eb41e6f',
  },
  {
    key: 'tokenizer',
    url: `${MODEL_BASE}/tokenizer.json`,
    sha256: '3564bb27a5b787b8ce0e415d4961a19c682d6fc70c3dc92341d9c699e11d37f6',
  },
  {
    key: 'tokenizerConfig',
    url: `${MODEL_BASE}/tokenizer_config.json`,
    sha256: '84e36de990575ab69acf45c7537a1bb7f1bd6ecba95ab4d5ba8bf64ccc24b2c8',
  },
]

const CACHE_NAME = 'luminalog-models-v1'

export class IntegrityError extends Error {
  constructor(key: ModelAssetKey, expected: string, actual: string) {
    super(`Integrity check failed for model asset "${key}": expected ${expected}, got ${actual}`)
    this.name = 'IntegrityError'
  }
}

/** Lowercase hex SHA-256 of the given bytes (WebCrypto). */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function assetFor(key: ModelAssetKey): ModelAsset {
  const asset = MODEL_ASSETS.find((a) => a.key === key)
  if (!asset) throw new Error(`Unknown model asset: ${key}`)
  return asset
}

/** True when the Cache API is available (browser). Node/SSR test runs skip caching. */
function cacheAvailable(): boolean {
  return typeof caches !== 'undefined'
}

/**
 * Fetch a model asset as verified bytes. Cache-API-first: a cached copy whose
 * SHA-256 matches is returned without a network round-trip. On a miss (or hash
 * mismatch) it downloads, verifies, caches, and returns; if freshly-downloaded
 * bytes still fail the hash it throws `IntegrityError` and caches nothing.
 */
export async function fetchAsset(
  key: ModelAssetKey,
  onProgress?: (loaded: number, total: number) => void,
): Promise<ArrayBuffer> {
  const asset = assetFor(key)
  const cache = cacheAvailable() ? await caches.open(CACHE_NAME) : null

  if (cache) {
    const hit = await cache.match(asset.url)
    if (hit) {
      const bytes = await hit.arrayBuffer()
      if ((await sha256Hex(bytes)) === asset.sha256) return bytes
      // Stale/corrupt cache entry — drop it and re-download.
      await cache.delete(asset.url)
    }
  }

  const res = await fetch(asset.url)
  if (!res.ok) throw new Error(`Failed to download model asset "${key}": HTTP ${res.status}`)

  const bytes = await readWithProgress(res, onProgress)
  const actual = await sha256Hex(bytes)
  if (actual !== asset.sha256) throw new IntegrityError(key, asset.sha256, actual)

  if (cache) await cache.put(asset.url, new Response(bytes.slice(0)))
  return bytes
}

/** Read a Response body to an ArrayBuffer, reporting progress when the length is known. */
async function readWithProgress(
  res: Response,
  onProgress?: (loaded: number, total: number) => void,
): Promise<ArrayBuffer> {
  const total = Number(res.headers.get('content-length') ?? 0)
  if (!onProgress || !res.body || !total) return res.arrayBuffer()

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.byteLength
    onProgress(loaded, total)
  }
  const out = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out.buffer
}
