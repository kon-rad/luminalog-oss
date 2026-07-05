// WebCrypto chunked media cipher. This on-disk/wire layout MUST stay
// byte-for-byte interoperable with the iOS app (`MediaCipher.swift`) and the
// Express server (`server/src/crypto/mediaCipher.ts`) — media encrypted on web
// has to decrypt on iOS/server and vice-versa.
//
// Layout:
//   [ "LLM1" magic (4B) ][ chunkSize UInt32 BE (4B) ]
//   then, per zero-based `index`: [ blob.length UInt32 BE (4B) ][ blob ]
//   where blob = iv(12) ‖ ciphertext ‖ tag(16)  (AES.GCM "combined" layout).
//
// AES-256-GCM, a fresh 12-byte random IV per chunk, a 16-byte tag. Each chunk
// is sealed with AAD = its zero-based index as UInt32 BE, so chunks cannot be
// reordered, dropped, or duplicated without failing authentication. Chunks hold
// `chunkSize` bytes of PLAINTEXT (the last chunk is a remainder).
//
// The media key is the SAME per-user DEK used for field encryption, imported as
// an AES-GCM `CryptoKey` (see `dek.ts`).

const MAGIC = 'LLM1'
const IV_BYTES = 12
const DEFAULT_CHUNK_SIZE = 1 << 20 // 1 MiB

/** Write a UInt32 big-endian into a fresh 4-byte Uint8Array. */
function be32(n: number): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, n >>> 0, false)
  return b
}

/** Read a UInt32 big-endian from `bytes` at `offset`. */
function readBe32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, false)
}

// Cast to an ArrayBuffer-backed view so it satisfies WebCrypto's `BufferSource`
// under TS 5.7+ (`Uint8Array<ArrayBufferLike>`).
function toBytes(data: Uint8Array | ArrayBuffer): Uint8Array<ArrayBuffer> {
  return (data instanceof Uint8Array ? data : new Uint8Array(data)) as Uint8Array<ArrayBuffer>
}

/**
 * Encrypt `data` into the chunked media envelope under `key`. Produces the exact
 * byte layout above; readable by the iOS/server `decryptMedia`.
 */
export async function encryptMedia(
  key: CryptoKey,
  data: Uint8Array | ArrayBuffer,
  chunkSize = DEFAULT_CHUNK_SIZE,
): Promise<Uint8Array> {
  const plain = toBytes(data)

  const parts: Uint8Array[] = [new TextEncoder().encode(MAGIC), be32(chunkSize)]
  let total = parts[0].length + parts[1].length

  let index = 0
  for (let off = 0; off < plain.length; off += chunkSize) {
    const chunk = plain.subarray(off, Math.min(off + chunkSize, plain.length))
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
    // WebCrypto returns ct‖tag joined; that is exactly the combined tail, so
    // blob = iv ‖ (ct‖tag).
    const ctTag = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: be32(index), tagLength: 128 },
        key,
        chunk as Uint8Array<ArrayBuffer>,
      ),
    )
    const blob = new Uint8Array(iv.length + ctTag.length)
    blob.set(iv, 0)
    blob.set(ctTag, iv.length)

    const len = be32(blob.length)
    parts.push(len, blob)
    total += len.length + blob.length
    index++
  }

  const out = new Uint8Array(total)
  let pos = 0
  for (const p of parts) {
    out.set(p, pos)
    pos += p.length
  }
  return out
}

/**
 * Decrypt a chunked media envelope under `key`. Verifies the "LLM1" magic,
 * re-splits each blob into iv ‖ (ct‖tag), and authenticates each chunk with its
 * zero-based index as AAD. Throws on a bad magic, truncation, or auth failure.
 */
export async function decryptMedia(
  key: CryptoKey,
  data: Uint8Array | ArrayBuffer,
): Promise<Uint8Array> {
  const bytes = toBytes(data)

  if (new TextDecoder().decode(bytes.subarray(0, 4)) !== MAGIC) {
    throw new Error('Malformed media file')
  }

  let pos = 8 // skip magic(4) + chunkSize(4)
  const chunks: Uint8Array[] = []
  let total = 0
  let index = 0

  while (pos < bytes.length) {
    if (pos + 4 > bytes.length) throw new Error('Truncated media chunk')
    const len = readBe32(bytes, pos)
    pos += 4
    if (pos + len > bytes.length) throw new Error('Truncated media chunk')
    const blob = bytes.subarray(pos, pos + len)
    pos += len

    const iv = blob.subarray(0, IV_BYTES) as Uint8Array<ArrayBuffer>
    const ctTag = blob.subarray(IV_BYTES) as Uint8Array<ArrayBuffer>
    const plain = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, additionalData: be32(index), tagLength: 128 },
        key,
        ctTag,
      ),
    )
    chunks.push(plain)
    total += plain.length
    index++
  }

  const out = new Uint8Array(total)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.length
  }
  return out
}

// --- Convenience Blob wrappers for the media pipeline ---

/** Read a Blob, encrypt it, and wrap the envelope in an octet-stream Blob. */
export async function encryptBlob(key: CryptoKey, blob: Blob): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const cipher = await encryptMedia(key, bytes)
  return new Blob([cipher as Uint8Array<ArrayBuffer>], { type: 'application/octet-stream' })
}

/** Decrypt a media envelope and wrap the plaintext in a Blob of `mimeType`. */
export async function decryptToBlob(
  key: CryptoKey,
  cipherBytes: Uint8Array,
  mimeType: string,
): Promise<Blob> {
  const plain = await decryptMedia(key, cipherBytes)
  return new Blob([plain as Uint8Array<ArrayBuffer>], { type: mimeType })
}
