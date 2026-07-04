// WebCrypto AES-256-GCM field encryption. This envelope MUST stay byte-for-byte
// interoperable with the iOS app (`FieldCipher.swift`) and the Express server
// (`server/src/crypto/fieldCipher.ts`): same envelope shape, same base64
// encoding, same AAD binding. See `aad.ts` for the context strings.
//
// Envelope: { v:1, alg:'A256GCM', iv:<b64 12B nonce>, ct:<b64 ciphertext>,
// tag:<b64 16B GCM tag> } — three SEPARATE standard-base64 fields.

export interface EncryptedField {
  v: number
  alg: 'A256GCM'
  iv: string
  ct: string
  tag: string
}

const VERSION = 1
const ALG = 'A256GCM' as const
const TAG_BYTES = 16

// --- base64 (standard, padded) — works in both browser and Node ---

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/

function isValidBase64(s: string): boolean {
  return s.length % 4 === 0 && BASE64_RE.test(s)
}

// Cast to an ArrayBuffer-backed view so it satisfies WebCrypto's `BufferSource`
// (TS 5.7+ types `TextEncoder.encode` as `Uint8Array<ArrayBufferLike>`).
const utf8 = (s: string) => new TextEncoder().encode(s) as Uint8Array<ArrayBuffer>

/** Encrypt one string field under `key`, binding `context` as GCM AAD. */
export async function encryptField(
  key: CryptoKey,
  plaintext: string,
  context: string,
): Promise<EncryptedField> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  // WebCrypto returns ct‖tag joined; split the trailing 16-byte tag off.
  const joined = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: utf8(context), tagLength: 128 },
      key,
      utf8(plaintext),
    ),
  )
  const ct = joined.slice(0, joined.length - TAG_BYTES)
  const tag = joined.slice(joined.length - TAG_BYTES)
  return {
    v: VERSION,
    alg: ALG,
    iv: bytesToBase64(iv),
    ct: bytesToBase64(ct),
    tag: bytesToBase64(tag),
  }
}

/**
 * Decrypt one envelope under `key` with `context` as GCM AAD. Rejects if the
 * tag/AAD don't authenticate (never returns ciphertext). Re-joins ct‖tag before
 * handing it to WebCrypto.
 */
export async function decryptField(
  key: CryptoKey,
  field: EncryptedField,
  context: string,
): Promise<string> {
  const iv = base64ToBytes(field.iv)
  const ct = base64ToBytes(field.ct)
  const tag = base64ToBytes(field.tag)
  const joined = new Uint8Array(ct.length + tag.length)
  joined.set(ct, 0)
  joined.set(tag, ct.length)
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: utf8(context), tagLength: 128 },
    key,
    joined,
  )
  return new TextDecoder().decode(plain)
}

/**
 * Strict envelope parse — mirrors iOS `EncryptedField.init?` + server
 * `isEncryptedField`. Rejects unless it's a v1 A256GCM object with three
 * base64-decodable string fields. A bare string / missing fields → NOT
 * encrypted, so legacy plaintext falls through the callers that check this.
 */
export function isEncryptedField(value: unknown): value is EncryptedField {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    v.v === VERSION &&
    v.alg === ALG &&
    typeof v.iv === 'string' &&
    isValidBase64(v.iv) &&
    typeof v.ct === 'string' &&
    isValidBase64(v.ct) &&
    typeof v.tag === 'string' &&
    isValidBase64(v.tag)
  )
}

/**
 * Decrypt a Firestore value that should be an envelope — for REQUIRED fields.
 * `null`/missing → ''; a non-envelope or un-decryptable value throws (fail
 * closed). Matches server `openField`.
 */
export async function openField(
  key: CryptoKey,
  value: unknown,
  context: string,
): Promise<string> {
  if (value == null) return ''
  if (!isEncryptedField(value)) throw new Error(`Expected EncryptedField at ${context}`)
  return decryptField(key, value, context)
}

/**
 * Lenient variant for OPTIONAL fields (e.g. a user's biography) where legacy
 * plaintext or un-decryptable data must not abort the whole read. Returns ''
 * (and logs) instead of throwing. Matches server `openFieldSafe`.
 */
export async function openFieldSafe(
  key: CryptoKey,
  value: unknown,
  context: string,
): Promise<string> {
  try {
    return await openField(key, value, context)
  } catch (err) {
    console.warn(`[fieldCipher] openFieldSafe falling back to '' at ${context}:`, String(err))
    return ''
  }
}
