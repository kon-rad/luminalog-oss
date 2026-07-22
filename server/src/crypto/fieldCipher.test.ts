import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import { encryptField, decryptField } from './fieldCipher'

const dek = () => crypto.randomBytes(32)

describe('fieldCipher', () => {
  it('round-trips encrypt → decrypt with the same key + context', () => {
    const key = dek()
    const env = encryptField('the quick brown fox 🦊', key, 'journals.content')
    expect(env.v).toBe(1)
    expect(env.alg).toBe('A256GCM')
    expect(decryptField(env, key, 'journals.content')).toBe('the quick brown fox 🦊')
  })

  it('produces a 12-byte IV and 16-byte tag (matching iOS AES-GCM)', () => {
    const env = encryptField('hi', dek(), 'journals.title')
    expect(Buffer.from(env.iv, 'base64').length).toBe(12)
    expect(Buffer.from(env.tag, 'base64').length).toBe(16)
  })

  it('throws when the context (AAD) differs from the one used to encrypt', () => {
    const key = dek()
    const env = encryptField('secret', key, 'journals.content')
    expect(() => decryptField(env, key, 'journals.title')).toThrow()
  })

  it('throws when the key is wrong', () => {
    const env = encryptField('secret', dek(), 'journals.content')
    expect(() => decryptField(env, dek(), 'journals.content')).toThrow()
  })

  it('throws on a tampered ciphertext', () => {
    const key = dek()
    const env = encryptField('secret', key, 'journals.content')
    const bad = { ...env, ct: Buffer.from('tampered').toString('base64') }
    expect(() => decryptField(bad, key, 'journals.content')).toThrow()
  })

  it('rejects a malformed envelope (wrong version/alg or non-string fields)', () => {
    const key = dek()
    const env = encryptField('secret', key, 'journals.content')
    expect(() => decryptField({ ...env, v: 2 }, key, 'journals.content')).toThrow()
    expect(() => decryptField({ ...env, alg: 'A128GCM' }, key, 'journals.content')).toThrow()
    expect(() => decryptField({ ...env, iv: 123 as any }, key, 'journals.content')).toThrow()
  })

  it('rejects a DEK that is not 32 bytes', () => {
    const env = encryptField('secret', dek(), 'journals.content')
    expect(() => decryptField(env, Buffer.alloc(16), 'journals.content')).toThrow()
  })
})
