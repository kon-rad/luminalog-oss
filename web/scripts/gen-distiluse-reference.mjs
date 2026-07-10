// DEV-ONLY (not shipped). Generates the canonical distiluse-512 reference vectors
// for the web parity gate (plan Task 3) by running the SAME hosted ONNX we ship,
// under onnxruntime-node, over the shared texts.json. The hosted graph was already
// validated against Python sentence-transformers (cosine 0.9999991, iOS gate), so
// this is canonical-by-construction. Downloads are cached in a scratch dir.
//
// Usage:  node scripts/gen-distiluse-reference.mjs
// Writes: src/lib/embeddings/__fixtures__/reference_vectors.json

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import * as ort from 'onnxruntime-node'
import { PreTrainedTokenizer } from '@huggingface/transformers'

const here = dirname(fileURLToPath(import.meta.url))
const web = join(here, '..')
const fixtures = join(web, 'src/lib/embeddings/__fixtures__')
const cacheDir = '/private/tmp/luminalog-distiluse-cache'
mkdirSync(cacheDir, { recursive: true })

const BASE = 'https://luminalog-models.s3.us-east-1.amazonaws.com/distiluse-multilingual/v1'
const ASSETS = {
  onnx: { file: 'distiluse-multilingual.onnx', sha: 'ef4f58f1eb478e3097c3b4f197c97390ae4decaedc363defbb937a4c8eb41e6f' },
  tokenizer: { file: 'tokenizer.json', sha: '3564bb27a5b787b8ce0e415d4961a19c682d6fc70c3dc92341d9c699e11d37f6' },
  tokenizerConfig: { file: 'tokenizer_config.json', sha: '84e36de990575ab69acf45c7537a1bb7f1bd6ecba95ab4d5ba8bf64ccc24b2c8' },
}

async function fetchCached({ file, sha }) {
  const path = join(cacheDir, file)
  if (existsSync(path)) {
    const buf = readFileSync(path)
    if (createHash('sha256').update(buf).digest('hex') === sha) return path
  }
  console.error(`Downloading ${file} …`)
  const res = await fetch(`${BASE}/${file}`)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${file}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const got = createHash('sha256').update(buf).digest('hex')
  if (got !== sha) throw new Error(`SHA-256 mismatch for ${file}: ${got}`)
  writeFileSync(path, buf)
  return path
}

function l2normalize(arr) {
  let mag = 0
  for (const x of arr) mag += x * x
  mag = Math.sqrt(mag)
  return arr.map((x) => x / mag)
}

const onnxPath = await fetchCached(ASSETS.onnx)
const tokPath = await fetchCached(ASSETS.tokenizer)
const cfgPath = await fetchCached(ASSETS.tokenizerConfig)

const tokenizer = new PreTrainedTokenizer(
  JSON.parse(readFileSync(tokPath, 'utf8')),
  JSON.parse(readFileSync(cfgPath, 'utf8')),
)

const session = await ort.InferenceSession.create(onnxPath)
console.error('ONNX inputNames:', session.inputNames)
console.error('ONNX outputNames:', session.outputNames)

const texts = JSON.parse(readFileSync(join(fixtures, 'texts.json'), 'utf8'))
const vectors = []
for (let i = 0; i < texts.length; i++) {
  const enc = await tokenizer(texts[i], { add_special_tokens: true })
  const ids = Array.from(enc.input_ids.data, (x) => BigInt(x))
  const mask = ids.map(() => BigInt(1))
  const len = ids.length
  const feeds = {
    input_ids: new ort.Tensor('int64', BigInt64Array.from(ids), [1, len]),
    attention_mask: new ort.Tensor('int64', BigInt64Array.from(mask), [1, len]),
  }
  const out = await session.run(feeds)
  const outName = session.outputNames[0]
  const t = out[outName]
  if (i === 0) console.error('output tensor dims:', t.dims)
  const vec = l2normalize(Array.from(t.data))
  if (vec.length !== 512) throw new Error(`Expected 512 dims, got ${vec.length} for text #${i}`)
  vectors.push(vec)
  console.error(`  [${i + 1}/${texts.length}] embedded`)
}

writeFileSync(
  join(fixtures, 'reference_vectors.json'),
  JSON.stringify({ model: 'distiluse-multilingual-v1', dimension: 512, texts, vectors }),
)
console.error(`Wrote ${vectors.length} reference vectors → reference_vectors.json`)
