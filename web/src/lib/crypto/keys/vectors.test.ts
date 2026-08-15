import { describe, expect, it } from 'vitest'
import { deriveKEK, normalize } from './recoveryCode'
import { unwrap, type WrappedKeyEnvelope } from '@/lib/crypto/wrappedKey'
import vectors from './__fixtures__/recovery-vectors.json'

// THE DRIFT GUARD. `RecoveryVectorTests.swift` asserts the SAME fixture. If one
// platform's crypto ever moves, exactly one of these two suites goes red, which
// is the only cheap way to catch a change that would otherwise surface as a user
// whose journal decrypts nowhere.

interface Vector {
  code: string
  normalized: string
  kekHex: string
  dekHex: string
  envelope: WrappedKeyEnvelope
}

const toHex = (b: Uint8Array) =>
  Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')

describe('recovery code cross-platform vectors', () => {
  const cases = vectors.cases as Vector[]

  it('has the cases the suite expects', () => {
    expect(cases).toHaveLength(3)
  })

  for (const [i, v] of cases.entries()) {
    it(`case ${i}: normalizes to the pinned value`, () => {
      expect(normalize(v.code)).toBe(v.normalized)
    })

    it(`case ${i}: derives the pinned KEK`, async () => {
      // deriveKEK returns a non-extractable key by design, so re-derive the raw
      // bits here rather than exporting it.
      const ikm = new TextEncoder().encode(normalize(v.code))
      const ikmKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
      const bits = await crypto.subtle.deriveBits(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: new TextEncoder().encode('luminalog-recovery-kek-salt-v1'),
          info: new TextEncoder().encode('luminalog-recovery-kek-v1'),
        },
        ikmKey,
        256,
      )
      expect(toHex(new Uint8Array(bits))).toBe(v.kekHex)
    })

    it(`case ${i}: the pinned KEK opens the pinned envelope`, async () => {
      const kek = await deriveKEK(v.code)
      const dek = await unwrap(kek, v.envelope)
      expect(toHex(dek)).toBe(v.dekHex)
    })
  }

  it('the two spellings of the same code derive the same KEK', () => {
    expect(cases[0].kekHex).toBe(cases[1].kekHex)
  })
})
