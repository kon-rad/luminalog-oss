import crypto from 'crypto'

/**
 * The at-rest envelope for one encrypted field, matching iOS `EncryptedField`
 * exactly: `{ v, alg, iv, ct, tag }` with base64 blobs.
 */
export interface FieldEnvelope {
  v: number
  alg: string
  iv: string
  ct: string
  tag: string
}

const VERSION = 1
const ALGORITHM = 'A256GCM'
const IV_BYTES = 12
const TAG_BYTES = 16
const KEY_BYTES = 32

/**
 * Decrypt a single field, matching iOS `FieldCipher` byte-for-byte:
 * AES-256-GCM with the 32-byte DEK, a 12-byte IV, a 16-byte auth tag, and the
 * `context` string bound as AAD (`Buffer.from(context, 'utf8')`, e.g.
 * `"journals.content"`). Throws on a malformed envelope, a wrong key, a wrong
 * context (AAD mismatch), or a tampered ciphertext (auth-tag failure).
 */
export function decryptField(envelope: FieldEnvelope, dek: Buffer, context: string): string {
  if (!envelope || typeof envelope !== 'object') {
    throw new Error('decryptField: missing envelope')
  }
  if (envelope.v !== VERSION || envelope.alg !== ALGORITHM) {
    throw new Error(`decryptField: unsupported envelope v=${envelope.v} alg=${envelope.alg}`)
  }
  if (typeof envelope.iv !== 'string' || typeof envelope.ct !== 'string' || typeof envelope.tag !== 'string') {
    throw new Error('decryptField: malformed envelope (iv/ct/tag must be base64 strings)')
  }
  if (!Buffer.isBuffer(dek) || dek.length !== KEY_BYTES) {
    throw new Error('decryptField: DEK must be a 32-byte Buffer')
  }

  const iv = Buffer.from(envelope.iv, 'base64')
  const ct = Buffer.from(envelope.ct, 'base64')
  const tag = Buffer.from(envelope.tag, 'base64')
  if (iv.length !== IV_BYTES) throw new Error('decryptField: IV must be 12 bytes')
  if (tag.length !== TAG_BYTES) throw new Error('decryptField: auth tag must be 16 bytes')

  const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv)
  decipher.setAAD(Buffer.from(context, 'utf8'))
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()])
  return plaintext.toString('utf8')
}

/**
 * Encrypt a single field into the same envelope shape iOS produces. Exported for
 * test fixtures / round-trip parity checks; the live server path only decrypts.
 */
export function encryptField(plaintext: string, dek: Buffer, context: string): FieldEnvelope {
  if (!Buffer.isBuffer(dek) || dek.length !== KEY_BYTES) {
    throw new Error('encryptField: DEK must be a 32-byte Buffer')
  }
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv)
  cipher.setAAD(Buffer.from(context, 'utf8'))
  const ct = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    v: VERSION,
    alg: ALGORITHM,
    iv: iv.toString('base64'),
    ct: ct.toString('base64'),
    tag: tag.toString('base64'),
  }
}
