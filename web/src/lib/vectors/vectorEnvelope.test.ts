import { describe, it, expect, beforeAll } from 'vitest'
import { vectorToBytes, bytesToVector, wrapVector, unwrapVector } from '@/lib/vectors/vectorEnvelope'

let dek: CryptoKey
beforeAll(async () => {
  dek = await crypto.subtle.importKey('raw', new Uint8Array(32), 'AES-GCM', false, ['encrypt', 'decrypt'])
})

describe('vector byte format', () => {
  it('serializes Float32 little-endian, 4 bytes per component, LSB first', () => {
    const bytes = vectorToBytes(new Float32Array([1.0]))
    // IEEE-754 1.0 = 0x3F800000; little-endian → 00 00 80 3F
    expect(Array.from(bytes)).toEqual([0x00, 0x00, 0x80, 0x3f])
  })
  it('round-trips a vector', () => {
    const v = new Float32Array([0.5, -0.25, 1e-3, 12345.6])
    expect(Array.from(bytesToVector(vectorToBytes(v)))).toEqual(Array.from(v))
  })
})

describe('wrapVector/unwrapVector', () => {
  it('produces a base64(JSON({v,iv,ct,tag})) blob that round-trips under the DEK', async () => {
    const v = new Float32Array(Array.from({ length: 512 }, (_, i) => (i % 7) - 3))
    const blob = await wrapVector(dek, v)
    const json = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(blob), (c) => c.charCodeAt(0))))
    expect(json).toMatchObject({ v: 1 })
    expect(typeof json.iv).toBe('string')
    expect(typeof json.ct).toBe('string')
    expect(typeof json.tag).toBe('string')
    const back = await unwrapVector(dek, blob)
    expect(Array.from(back)).toEqual(Array.from(v))
  })
})
