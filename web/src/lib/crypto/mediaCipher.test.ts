import { describe, it, expect, beforeAll } from 'vitest'
import { Buffer } from 'node:buffer'
import { encryptMedia as webEncrypt, decryptMedia as webDecrypt } from './mediaCipher'
// The SHIPPING server implementation we must interoperate with byte-for-byte.
// (vitest/esbuild transpiles this TS on the fly; it only imports node `crypto`.)
import {
  encryptMedia as srvEncrypt,
  decryptMedia as srvDecrypt,
} from '../../../../server/src/crypto/mediaCipher'

// One 32-byte AES-256 key, materialised two ways so web and server share it.
const keyBytes = new Uint8Array(32)
for (let i = 0; i < 32; i++) keyBytes[i] = (i * 7 + 3) % 256
const srvKey = Buffer.from(keyBytes)
let webKey: CryptoKey

// A patterned pseudo-random payload a few hundred bytes long.
function makeBytes(n: number): Uint8Array {
  const b = new Uint8Array(n)
  for (let i = 0; i < n; i++) b[i] = (i * 31 + 17) % 256
  return b
}

// Small chunk sizes so multi-chunk paths (and the per-chunk AAD index) run.
const CHUNK = 16

// Data sizes: multi-chunk, exact chunk boundary, single byte, empty.
const SIZES: Array<[string, number]> = [
  ['multi-chunk (300B)', 300],
  ['exact multiple (64B = 4 chunks)', 64],
  ['single byte', 1],
  ['empty', 0],
]

beforeAll(async () => {
  webKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ])
})

describe('cross-client media parity (web ⇄ server)', () => {
  describe('web encrypt → server decrypt', () => {
    for (const [name, size] of SIZES) {
      it(name, async () => {
        const data = makeBytes(size)
        const cipher = await webEncrypt(webKey, data, CHUNK)
        const plain = srvDecrypt(srvKey, Buffer.from(cipher))
        expect(Buffer.from(plain).equals(Buffer.from(data))).toBe(true)
      })
    }
  })

  describe('server encrypt → web decrypt', () => {
    for (const [name, size] of SIZES) {
      it(name, async () => {
        const data = makeBytes(size)
        // Force multiple chunks by passing the same small chunkSize.
        const cipher = srvEncrypt(srvKey, Buffer.from(data), CHUNK)
        const plain = await webDecrypt(webKey, cipher)
        expect(Buffer.from(plain).equals(Buffer.from(data))).toBe(true)
      })
    }
  })
})

describe('web round-trip', () => {
  it('encrypt → decrypt returns the original (multi-chunk)', async () => {
    const data = makeBytes(300)
    const cipher = await webEncrypt(webKey, data, CHUNK)
    const plain = await webDecrypt(webKey, cipher)
    expect(Buffer.from(plain).equals(Buffer.from(data))).toBe(true)
  })

  it('honours the default 1 MiB chunk size for a large payload', async () => {
    const data = makeBytes(2500)
    const cipher = await webEncrypt(webKey, data) // default chunkSize
    const plain = await webDecrypt(webKey, cipher)
    expect(Buffer.from(plain).equals(Buffer.from(data))).toBe(true)
  })
})

describe('per-chunk AAD binds the index', () => {
  it('rejects reordered chunks (multi-chunk payload)', async () => {
    const data = makeBytes(48) // 3 chunks of 16
    const cipher = await webEncrypt(webKey, data, CHUNK)

    // Parse header + the three [len][blob] records.
    const records: Uint8Array[] = []
    let pos = 8
    while (pos < cipher.length) {
      const view = new DataView(cipher.buffer, cipher.byteOffset + pos, 4)
      const len = view.getUint32(0, false)
      records.push(cipher.subarray(pos, pos + 4 + len))
      pos += 4 + len
    }
    expect(records.length).toBe(3)

    // Swap the first two chunks — indices no longer match their AAD.
    const swapped = new Uint8Array(cipher.length)
    swapped.set(cipher.subarray(0, 8), 0)
    let o = 8
    for (const rec of [records[1], records[0], records[2]]) {
      swapped.set(rec, o)
      o += rec.length
    }

    await expect(webDecrypt(webKey, swapped)).rejects.toThrow()
  })

  it('rejects a single-chunk blob decrypted at the wrong index', async () => {
    // A one-chunk envelope sealed with AAD index 0; server/web decrypt starts at
    // index 0, so it must succeed here — then corrupt by prepending a phantom
    // empty first record so the real chunk lands at index 1.
    const data = makeBytes(10)
    const cipher = await webEncrypt(webKey, data, CHUNK)
    // Duplicate the sole chunk so the second copy is authenticated at index 1.
    let pos = 8
    const view = new DataView(cipher.buffer, cipher.byteOffset + pos, 4)
    const len = view.getUint32(0, false)
    const record = cipher.subarray(pos, pos + 4 + len)
    const dup = new Uint8Array(cipher.length + record.length)
    dup.set(cipher, 0)
    dup.set(record, cipher.length) // second copy → index 1 → AAD mismatch
    await expect(webDecrypt(webKey, dup)).rejects.toThrow()
  })
})

describe('magic check', () => {
  it('throws on input not starting with LLM1', async () => {
    const bad = new Uint8Array(16)
    bad.set(new TextEncoder().encode('XXXX'), 0)
    await expect(webDecrypt(webKey, bad)).rejects.toThrow('Malformed media file')
  })

  it('throws on truncated chunk length', async () => {
    const data = makeBytes(40)
    const cipher = await webEncrypt(webKey, data, CHUNK)
    // Chop the tail so the last chunk is truncated mid-blob.
    await expect(webDecrypt(webKey, cipher.subarray(0, cipher.length - 5))).rejects.toThrow()
  })
})
