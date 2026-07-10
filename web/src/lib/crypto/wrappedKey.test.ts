import { describe, it, expect, beforeAll } from 'vitest'
import { wrap, unwrap, isWrappedKeyEnvelope } from '@/lib/crypto/wrappedKey'

let key: CryptoKey
beforeAll(async () => {
  key = await crypto.subtle.importKey('raw', new Uint8Array(32), 'AES-GCM', false, ['encrypt', 'decrypt'])
})

describe('WrappedKey envelope', () => {
  it('round-trips arbitrary bytes and yields a v1 {iv,ct,tag} envelope with a 12-byte iv and 16-byte tag', async () => {
    const plaintext = new Uint8Array([1, 2, 3, 4, 250, 251, 252])
    const env = await wrap(key, plaintext)
    expect(env.v).toBe(1)
    expect(isWrappedKeyEnvelope(env)).toBe(true)
    expect(atob(env.iv).length).toBe(12)
    expect(atob(env.tag).length).toBe(16)
    const out = await unwrap(key, env)
    expect(Array.from(out)).toEqual(Array.from(plaintext))
  })

  it('fails closed on a tampered tag', async () => {
    const env = await wrap(key, new Uint8Array([9, 9, 9]))
    const bad = { ...env, tag: btoa('0123456789abcdef') } // wrong 16-byte tag
    await expect(unwrap(key, bad)).rejects.toThrow()
  })

  it('rejects a malformed envelope (wrong iv length)', () => {
    expect(isWrappedKeyEnvelope({ v: 1, iv: btoa('short'), ct: 'x', tag: btoa('0123456789abcdef') })).toBe(false)
  })
})
