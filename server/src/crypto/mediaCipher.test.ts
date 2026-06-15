import { describe, it, expect } from 'vitest'
import { randomBytes } from 'crypto'
import { encryptMedia, decryptMedia } from './mediaCipher'

describe('mediaCipher', () => {
  const key = randomBytes(32)
  it('round-trips multi-chunk', () => {
    const payload = randomBytes(10_000)
    const enc = encryptMedia(key, payload, 1024)
    expect(enc.subarray(0, 4).toString()).toBe('LLM1')
    expect(decryptMedia(key, enc).equals(payload)).toBe(true)
  })
  it('round-trips single small chunk', () => {
    const payload = Buffer.from('hello media')
    expect(decryptMedia(key, encryptMedia(key, payload)).equals(payload)).toBe(true)
  })
  it('tamper fails closed', () => {
    const enc = encryptMedia(key, randomBytes(5000), 1024)
    enc[enc.length - 1] ^= 0xff
    expect(() => decryptMedia(key, enc)).toThrow()
  })
})
