// Vector serialization + sealing, byte-compatible with iOS `EmbeddingVector.data`
// + `VectorBlobCodec`. A 512-dim vector is encoded as little-endian IEEE-754
// Float32 (4 bytes/component, LSB first), sealed under the per-user DEK via the
// no-AAD `WrappedKey` envelope, and the envelope JSON is base64-encoded to the
// opaque `blob` string stored in `/v1/vectors`:
//     blob = base64( UTF8( JSON( {v,iv,ct,tag} ) ) )

import { wrap, unwrap, type WrappedKeyEnvelope } from '@/lib/crypto/wrappedKey'

/** Float32Array → little-endian byte layout (V8/browsers are little-endian). */
export function vectorToBytes(v: Float32Array): Uint8Array {
  // Copy into a fresh Float32Array so the backing buffer is exactly this vector.
  return new Uint8Array(new Float32Array(v).buffer)
}

/** Little-endian Float32 bytes → Float32Array. */
export function bytesToVector(bytes: Uint8Array): Float32Array {
  if (bytes.byteLength % 4 !== 0) throw new Error('Vector byte length must be a multiple of 4')
  // Align to a fresh buffer (the input may be a view at a non-zero offset).
  const copy = new Uint8Array(bytes)
  return new Float32Array(copy.buffer)
}

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

function base64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

/** Seal a vector under the DEK → the opaque `blob` string. */
export async function wrapVector(dek: CryptoKey, vector: Float32Array): Promise<string> {
  const env = await wrap(dek, vectorToBytes(vector))
  return base64(utf8(JSON.stringify(env)))
}

/** Open an opaque `blob` string under the DEK → the vector. Fails closed. */
export async function unwrapVector(dek: CryptoKey, blob: string): Promise<Float32Array> {
  const env = JSON.parse(new TextDecoder().decode(fromBase64(blob))) as WrappedKeyEnvelope
  const bytes = await unwrap(dek, env)
  return bytesToVector(bytes)
}
