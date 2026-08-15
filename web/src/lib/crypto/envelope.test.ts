import { describe, it, expect, beforeAll } from 'vitest'
import { Buffer } from 'node:buffer'
import {
  encryptField as webEncrypt,
  decryptField as webDecrypt,
  isEncryptedField,
  type EncryptedField,
} from './envelope'
// The SHIPPING server implementation we must interoperate with byte-for-byte.
// (vitest/esbuild transpiles this TS on the fly; it only imports node `crypto`.)
import {
  encryptField as srvEncrypt,
  decryptField as srvDecrypt,
} from '../../../../server/src/crypto/fieldCipher'
import { AAD } from './aad'

// One 32-byte AES-256 key, materialised two ways so web and server share it.
const keyBytes = new Uint8Array(32)
for (let i = 0; i < 32; i++) keyBytes[i] = (i * 7 + 3) % 256
const srvKey = Buffer.from(keyBytes)
let webKey: CryptoKey

const CTX = AAD.journalsContent
const OTHER_CTX = AAD.journalsTitle

const SAMPLES: Array<[string, string]> = [
  ['ascii', 'The quick brown fox jumps over the lazy dog.'],
  ['unicode/emoji', 'héllo 🌌 世界, journaling ✨ naïve café'],
  ['empty', ''],
]

beforeAll(async () => {
  webKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ])
})

describe('cross-client parity (web ⇄ server)', () => {
  // NOTE the two argument orders, which are NOT the same and must not be
  // "tidied" into agreement: the web helpers take the key first
  // (`encryptField(key, plaintext, context)`) while the shipping server helpers
  // take the payload first (`encryptField(plaintext, dek, context)`). Passing
  // key-first to the server functions is what silently broke this whole file.
  describe('web encrypt → server decrypt', () => {
    for (const [name, plaintext] of SAMPLES) {
      it(name, async () => {
        const field = await webEncrypt(webKey, plaintext, CTX)
        expect(srvDecrypt(field, srvKey, CTX)).toBe(plaintext)
      })
    }
  })

  describe('server encrypt → web decrypt', () => {
    for (const [name, plaintext] of SAMPLES) {
      it(name, async () => {
        const field = srvEncrypt(plaintext, srvKey, CTX)
        expect(await webDecrypt(webKey, field as EncryptedField, CTX)).toBe(plaintext)
      })
    }
  })

  describe('wrong AAD fails (fail closed)', () => {
    it('server rejects a web envelope under a different context', async () => {
      const field = await webEncrypt(webKey, 'secret', CTX)
      expect(() => srvDecrypt(field, srvKey, OTHER_CTX)).toThrow()
    })

    it('web rejects a server envelope under a different context', async () => {
      const field = srvEncrypt('secret', srvKey, CTX)
      await expect(webDecrypt(webKey, field as EncryptedField, OTHER_CTX)).rejects.toThrow()
    })
  })
})

describe('isEncryptedField (strict parse)', () => {
  it('accepts a valid envelope', async () => {
    const field = await webEncrypt(webKey, 'hi', CTX)
    expect(isEncryptedField(field)).toBe(true)
  })

  it('rejects a bare string (legacy plaintext)', () => {
    expect(isEncryptedField('just some plaintext')).toBe(false)
  })

  it('rejects a wrong version', () => {
    expect(isEncryptedField({ v: 2, alg: 'A256GCM', iv: '', ct: '', tag: '' })).toBe(false)
  })

  it('rejects a wrong algorithm', () => {
    expect(isEncryptedField({ v: 1, alg: 'other', iv: '', ct: '', tag: '' })).toBe(false)
  })

  it('rejects a missing-field object', () => {
    expect(isEncryptedField({ v: 1, alg: 'A256GCM', iv: 'AAAA' })).toBe(false)
  })

  it('rejects null / undefined', () => {
    expect(isEncryptedField(null)).toBe(false)
    expect(isEncryptedField(undefined)).toBe(false)
  })
})

describe('round-trip within web for a few AAD constants', () => {
  const contexts = [
    AAD.journalsTitle,
    AAD.journalsContent,
    AAD.usersBiography,
    AAD.usersProfileDetail('goals'),
    AAD.journalsPromptItem(0),
    AAD.messagesSourceSnippet(3),
  ]
  for (const ctx of contexts) {
    it(ctx, async () => {
      const plaintext = `payload for ${ctx}`
      const field: EncryptedField = await webEncrypt(webKey, plaintext, ctx)
      expect(await webDecrypt(webKey, field, ctx)).toBe(plaintext)
    })
  }
})
