// The `WrappedKey` envelope — `{v,iv,ct,tag}`, AES-256-GCM, **no AAD** — byte-
// compatible with iOS `WrappedKey.swift` (`firestoreData`) and the server
// `WrappedDEK`. This is DISTINCT from the field-encryption envelope in
// `envelope.ts` (`{v,alg,iv,ct,tag}`, AAD-bound): the wrapped-key/vector path
// uses no AAD and no `alg` field, matching CryptoKit's `AES.GCM.seal(..)` with a
// fresh nonce. Reused for both the DEK wrap (passkey-PRF) and the vector wrap.

const VERSION = 1
const IV_BYTES = 12
const TAG_BYTES = 16

export interface WrappedKeyEnvelope {
  v: 1
  iv: string // base64, 12-byte GCM nonce
  ct: string // base64 ciphertext
  tag: string // base64, 16-byte GCM tag
}

function toBase64(bytes: Uint8Array): string {
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

export function isWrappedKeyEnvelope(value: unknown): value is WrappedKeyEnvelope {
  if (typeof value !== 'object' || value === null) return false
  const e = value as Record<string, unknown>
  if (e.v !== VERSION) return false
  if (typeof e.iv !== 'string' || typeof e.ct !== 'string' || typeof e.tag !== 'string') return false
  try {
    return fromBase64(e.iv).length === IV_BYTES && fromBase64(e.tag).length === TAG_BYTES && fromBase64(e.ct).length > 0
  } catch {
    return false
  }
}

/** Seal `plaintext` under `key` (AES-256-GCM, fresh 12-byte nonce, no AAD). */
export async function wrap(key: CryptoKey, plaintext: Uint8Array): Promise<WrappedKeyEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const combined = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext))
  // WebCrypto returns ciphertext||tag; split off the trailing 16-byte tag to
  // match the CryptoKit `{ct, tag}` split.
  const ct = combined.slice(0, combined.length - TAG_BYTES)
  const tag = combined.slice(combined.length - TAG_BYTES)
  return { v: VERSION, iv: toBase64(iv), ct: toBase64(ct), tag: toBase64(tag) }
}

/** Open a `WrappedKey` envelope under `key`. Fails closed on tamper / wrong key / malformed. */
export async function unwrap(key: CryptoKey, env: WrappedKeyEnvelope): Promise<Uint8Array> {
  if (!isWrappedKeyEnvelope(env)) throw new Error('Malformed WrappedKey envelope')
  const iv = fromBase64(env.iv)
  const ct = fromBase64(env.ct)
  const tag = fromBase64(env.tag)
  const combined = new Uint8Array(ct.length + tag.length)
  combined.set(ct, 0)
  combined.set(tag, ct.length)
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, combined)
  return new Uint8Array(plaintext)
}
