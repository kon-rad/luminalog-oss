// Web port of iOS `Core/Crypto/RecoveryCode.swift`. Pure, no I/O.
//
// The recovery code is a high-entropy secret shown to the user exactly once at
// setup and stored nowhere. A KEK derived from it via HKDF-SHA256 wraps the DEK
// (see `../wrappedKey.ts`), which is the ONLY door a browser has: the other wrap
// slot is an iCloud Keychain key that no browser can reach.
//
// Every constant here is byte-exact with the Swift original. Changing any of
// them silently locks every existing user out of the web app, so they are
// pinned by the shared vector fixture in `vectors.test.ts`.

/** Crockford base32: 32 symbols, excluding the ambiguous I, L, O and U. */
export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** Fixed application salt, constant across all users and devices. */
const HKDF_SALT = new TextEncoder().encode('luminalog-recovery-kek-salt-v1')

/** HKDF `info`, for domain separation. */
const HKDF_INFO = new TextEncoder().encode('luminalog-recovery-kek-v1')

/** Bytes of entropy in a generated code (256-bit). */
const ENTROPY_BYTES = 32

/**
 * Normalize a user-entered code: strip separators and whitespace, upper-case,
 * and map the glyphs a human might type back to their canonical symbols, so a
 * mistyped-but-unambiguous code still derives the right KEK.
 */
export function normalize(code: string): string {
  let out = ''
  for (const ch of code.toUpperCase()) {
    if (ch === '-' || /\s/.test(ch)) continue
    if (ch === 'O') out += '0'
    else if (ch === 'I' || ch === 'L') out += '1'
    else if (ch === 'U') out += 'V'
    else out += ch
  }
  return out
}

/** Crockford base32, five bits at a time, most significant first. */
export function base32Encode(bytes: Uint8Array): string {
  let out = ''
  let buffer = 0
  let bitsLeft = 0
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte
    bitsLeft += 8
    while (bitsLeft >= 5) {
      out += ALPHABET[(buffer >> (bitsLeft - 5)) & 0x1f]
      bitsLeft -= 5
    }
  }
  if (bitsLeft > 0) out += ALPHABET[(buffer << (5 - bitsLeft)) & 0x1f]
  return out
}

/** Insert a separator every `size` characters. */
export function group(s: string, size = 4): string {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && i % size === 0) out += '-'
    out += s[i]
  }
  return out
}

/** Generate a fresh 256-bit recovery code: 52 base32 chars in 13 groups of 4. */
export function generate(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ENTROPY_BYTES))
  return group(base32Encode(bytes))
}

/**
 * Derive the 256-bit recovery KEK from `code` via HKDF-SHA256 over the
 * NORMALIZED code, with the fixed app salt and versioned info string.
 *
 * Returned non-extractable so the derived key can never leave the browser's key
 * store, and typed AES-GCM so it feeds `wrap`/`unwrap` directly.
 */
export async function deriveKEK(code: string): Promise<CryptoKey> {
  const ikm = new TextEncoder().encode(normalize(code))
  const ikmKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: HKDF_SALT, info: HKDF_INFO },
    ikmKey,
    256,
  )
  return crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt', 'decrypt'])
}
