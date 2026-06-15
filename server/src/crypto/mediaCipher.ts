import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const MAGIC = Buffer.from('LLM1')

function be32(n: number): Buffer { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0, 0); return b }

export function encryptMedia(key: Buffer, data: Buffer, chunkSize = 1 << 20): Buffer {
  const out: Buffer[] = [MAGIC, be32(chunkSize)]
  let index = 0
  for (let off = 0; off < data.length; off += chunkSize) {
    const chunk = data.subarray(off, Math.min(off + chunkSize, data.length))
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    cipher.setAAD(be32(index))
    const ct = Buffer.concat([cipher.update(chunk), cipher.final()])
    const blob = Buffer.concat([iv, ct, cipher.getAuthTag()]) // nonce||ct||tag
    out.push(be32(blob.length), blob)
    index++
  }
  return Buffer.concat(out)
}

export function decryptMedia(key: Buffer, data: Buffer): Buffer {
  if (!data.subarray(0, 4).equals(MAGIC)) throw new Error('Malformed media file')
  let pos = 8 // skip magic(4) + chunkSize(4)
  const out: Buffer[] = []
  let index = 0
  while (pos < data.length) {
    const len = data.readUInt32BE(pos); pos += 4
    const blob = data.subarray(pos, pos + len); pos += len
    if (blob.length !== len) throw new Error('Truncated media chunk')
    const iv = blob.subarray(0, 12)
    const tag = blob.subarray(blob.length - 16)
    const ct = blob.subarray(12, blob.length - 16)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAAD(be32(index))
    decipher.setAuthTag(tag)
    out.push(Buffer.concat([decipher.update(ct), decipher.final()]))
    index++
  }
  return Buffer.concat(out)
}
