import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

export interface EncryptedField {
  v: number
  alg: 'A256GCM'
  iv: string
  ct: string
  tag: string
}

const VERSION = 1
const ALG = 'A256GCM' as const

export function encryptField(key: Buffer, plaintext: string, context: string): EncryptedField {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(context, 'utf8'))
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return { v: VERSION, alg: ALG, iv: iv.toString('base64'), ct: ct.toString('base64'), tag: tag.toString('base64') }
}

export function decryptField(key: Buffer, field: EncryptedField, context: string): string {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(field.iv, 'base64'))
  decipher.setAAD(Buffer.from(context, 'utf8'))
  decipher.setAuthTag(Buffer.from(field.tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(field.ct, 'base64')), decipher.final()]).toString('utf8')
}

export function isEncryptedField(value: unknown): value is EncryptedField {
  return !!value && typeof value === 'object'
    && (value as any).v === VERSION && (value as any).alg === ALG
    && typeof (value as any).iv === 'string' && typeof (value as any).ct === 'string'
    && typeof (value as any).tag === 'string'
}

/** Decrypt a Firestore value that should be an envelope; '' for missing, throws on garbled. */
export function openField(key: Buffer, value: unknown, context: string): string {
  if (value == null) return ''
  if (!isEncryptedField(value)) throw new Error(`Expected EncryptedField at ${context}`)
  return decryptField(key, value, context)
}
