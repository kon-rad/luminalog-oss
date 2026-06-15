import { describe, it, expect } from 'vitest'
import { randomBytes } from 'crypto'
import { encryptField, decryptField, isEncryptedField, EncryptedField } from './fieldCipher'

describe('fieldCipher', () => {
  const key = randomBytes(32)

  it('round-trips', () => {
    const env = encryptField(key, 'Secret entry body.', 'journals.content')
    expect(env.v).toBe(1); expect(env.alg).toBe('A256GCM')
    expect(decryptField(key, env, 'journals.content')).toBe('Secret entry body.')
  })

  it('ciphertext is not plaintext', () => {
    const env = encryptField(key, 'secret diary', 'journals.content')
    expect(Buffer.from(env.ct, 'base64').toString('utf8')).not.toBe('secret diary')
  })

  it('wrong AAD context fails closed', () => {
    const env = encryptField(key, 'data', 'journals.content')
    expect(() => decryptField(key, env, 'journals.title')).toThrow()
  })

  it('wrong key fails closed', () => {
    const env = encryptField(key, 'data', 'c')
    expect(() => decryptField(randomBytes(32), env, 'c')).toThrow()
  })

  it('tampered tag fails closed', () => {
    const env = encryptField(key, 'data', 'c')
    const bad: EncryptedField = { ...env, tag: Buffer.alloc(16).toString('base64') }
    expect(() => decryptField(key, bad, 'c')).toThrow()
  })

  it('random nonce per call', () => {
    const a = encryptField(key, 'data', 'c'); const b = encryptField(key, 'data', 'c')
    expect(a.iv).not.toBe(b.iv); expect(a.ct).not.toBe(b.ct)
  })

  it('isEncryptedField rejects plain values', () => {
    expect(isEncryptedField('plain string')).toBe(false)
    expect(isEncryptedField({ v: 2 })).toBe(false)
    expect(isEncryptedField(encryptField(key, 'x', 'c'))).toBe(true)
  })
})
