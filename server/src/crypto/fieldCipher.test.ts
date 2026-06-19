import { describe, it, expect } from 'vitest'
import { randomBytes } from 'crypto'
import { encryptField, decryptField, isEncryptedField, openField, openFieldSafe, EncryptedField } from './fieldCipher'

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

  describe('openField', () => {
    it('returns "" for missing values', () => {
      expect(openField(key, null, 'users.biography')).toBe('')
      expect(openField(key, undefined, 'users.biography')).toBe('')
    })

    it('decrypts a valid envelope', () => {
      const env = encryptField(key, 'my bio', 'users.biography')
      expect(openField(key, env, 'users.biography')).toBe('my bio')
    })

    // The chat-never-sends bug: a legacy/plaintext biography made openField
    // throw at chat.ts:25 outside any try/catch → request hung 60s, no reply.
    it('throws on legacy/plaintext (non-envelope) values', () => {
      expect(() => openField(key, 'plaintext bio', 'users.biography')).toThrow()
    })
  })

  describe('openFieldSafe', () => {
    it('never throws on legacy/plaintext values — returns ""', () => {
      expect(openFieldSafe(key, 'plaintext bio', 'users.biography')).toBe('')
      expect(openFieldSafe(key, { v: 2 }, 'users.biography')).toBe('')
    })

    it('still decrypts valid envelopes', () => {
      const env = encryptField(key, 'my bio', 'users.biography')
      expect(openFieldSafe(key, env, 'users.biography')).toBe('my bio')
    })

    it('returns "" for missing values', () => {
      expect(openFieldSafe(key, undefined, 'users.biography')).toBe('')
    })
  })
})
