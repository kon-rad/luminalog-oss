import { describe, expect, it } from 'vitest'
import {
  ALPHABET,
  base32Encode,
  deriveKEK,
  generate,
  group,
  normalize,
} from './recoveryCode'

describe('normalize', () => {
  it('strips separators and whitespace and upper-cases', () => {
    expect(normalize('abcd-2345')).toBe('ABCD2345')
    expect(normalize('ab cd 23 45')).toBe('ABCD2345')
    expect(normalize('AbCd-2345')).toBe('ABCD2345')
    expect(normalize('ABCD\t2345\n')).toBe('ABCD2345')
  })

  it('maps every ambiguous glyph', () => {
    // O to 0, I to 1, L to 1, U to V. Matches RecoveryCode.swift exactly.
    expect(normalize('OILU')).toBe('011V')
    expect(normalize('oilu')).toBe('011V')
  })

  it('is idempotent', () => {
    expect(normalize(normalize('oi-lu 23'))).toBe(normalize('oi-lu 23'))
  })
})

describe('base32Encode', () => {
  it('uses the Crockford alphabet with no ambiguous glyphs', () => {
    expect(ALPHABET).toBe('0123456789ABCDEFGHJKMNPQRSTVWXYZ')
    expect(ALPHABET).toHaveLength(32)
    for (const ch of 'ILOU') expect(ALPHABET).not.toContain(ch)
  })

  it('encodes 32 bytes to 52 characters', () => {
    expect(base32Encode(new Uint8Array(32))).toHaveLength(52)
  })

  it('encodes all-zero bytes as all zeros', () => {
    expect(base32Encode(new Uint8Array(5))).toBe('00000000')
  })

  it('packs five bits at a time, most significant first', () => {
    // 0xFF = 11111111. First 5 bits 11111 gives index 31, the last symbol 'Z'.
    // Remaining 3 bits 111 left-shifted by 2 gives 11100, index 28. Because the
    // alphabet omits I, L, O and U it drifts from ASCII, so index 28 is 'W'.
    expect(ALPHABET[31]).toBe('Z')
    expect(ALPHABET[28]).toBe('W')
    expect(base32Encode(new Uint8Array([0xff]))).toBe('ZW')
  })
})

describe('group', () => {
  it('inserts a hyphen every four characters', () => {
    expect(group('ABCD2345')).toBe('ABCD-2345')
    expect(group('ABC')).toBe('ABC')
    expect(group('')).toBe('')
  })
})

describe('generate', () => {
  it('produces 13 groups of 4 from the Crockford alphabet', () => {
    const code = generate()
    const groups = code.split('-')
    expect(groups).toHaveLength(13)
    for (const g of groups) expect(g).toHaveLength(4)

    const payload = code.replaceAll('-', '')
    expect(payload).toHaveLength(52)
    for (const ch of payload) expect(ALPHABET).toContain(ch)
  })

  it('never emits an ambiguous glyph', () => {
    for (let i = 0; i < 50; i++) {
      expect(generate()).not.toMatch(/[ILOU]/)
    }
  })

  it('produces unique codes', () => {
    const codes = new Set(Array.from({ length: 200 }, () => generate()))
    expect(codes.size).toBe(200)
  })
})

describe('deriveKEK', () => {
  it('is insensitive to case and separators', async () => {
    const a = await deriveKEK('ABCD-2345-WXYZ')
    const b = await deriveKEK('abcd2345wxyz')
    // Non-extractable keys cannot be compared directly, so compare by behavior:
    // a ciphertext sealed under `a` must open under `b`.
    const iv = new Uint8Array(12)
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, a, new Uint8Array([7, 8, 9]))
    const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, b, ct))
    expect(Array.from(pt)).toEqual([7, 8, 9])
  })

  it('derives a different key for a different code', async () => {
    const a = await deriveKEK('ABCD-2345')
    const b = await deriveKEK('ABCD-2346')
    const iv = new Uint8Array(12)
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, a, new Uint8Array([1]))
    await expect(crypto.subtle.decrypt({ name: 'AES-GCM', iv }, b, ct)).rejects.toThrow()
  })

  it('returns a non-extractable AES-GCM key', async () => {
    const k = await deriveKEK('ABCD-2345')
    expect(k.extractable).toBe(false)
    expect(k.algorithm.name).toBe('AES-GCM')
    await expect(crypto.subtle.exportKey('raw', k)).rejects.toThrow()
  })
})
