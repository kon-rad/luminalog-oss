// Regenerates recovery-vectors.json. Run once, by hand, from web/:
//   node src/lib/crypto/keys/__fixtures__/generate-vectors.mjs > \
//     src/lib/crypto/keys/__fixtures__/recovery-vectors.json
//
// The fixture is asserted by BOTH vectors.test.ts (web) and
// RecoveryVectorTests.swift (iOS). Do not regenerate it casually: changing the
// vectors would mask exactly the drift they exist to catch. Regenerate only
// when deliberately adding a case, never to "fix" a failing assertion.

const enc = new TextEncoder()
const SALT = enc.encode('luminalog-recovery-kek-salt-v1')
const INFO = enc.encode('luminalog-recovery-kek-v1')
const hex = (b) => Buffer.from(b).toString('hex')
const b64 = (b) => Buffer.from(b).toString('base64')

function normalize(code) {
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

async function kekBits(code) {
  const k = await crypto.subtle.importKey('raw', enc.encode(normalize(code)), 'HKDF', false, [
    'deriveBits',
  ])
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: SALT, info: INFO }, k, 256),
  )
}

// Three cases: a canonical grouped code, the same code written sloppily (proving
// normalization), and a code exercising every ambiguous glyph.
const CODES = [
  'ABCD-2345-WXYZ-0000-1111-2222-3333-4444-5555-6666-7777-8888-9999',
  'abcd 2345 wxyz 0000 1111 2222 3333 4444 5555 6666 7777 8888 9999',
  'OILU-OILU-OILU-OILU',
]

// A fixed, non-random DEK so the fixture is stable and reviewable.
const DEK = new Uint8Array(32)
for (let i = 0; i < 32; i++) DEK[i] = i

const cases = []
for (const code of CODES) {
  const bits = await kekBits(code)
  const kek = await crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt', 'decrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const combined = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, DEK))
  cases.push({
    code,
    normalized: normalize(code),
    kekHex: hex(bits),
    dekHex: hex(DEK),
    envelope: {
      v: 1,
      iv: b64(iv),
      ct: b64(combined.slice(0, combined.length - 16)),
      tag: b64(combined.slice(combined.length - 16)),
    },
  })
}

console.log(JSON.stringify({ note: 'See generate-vectors.mjs. Do not edit by hand.', cases }, null, 2))
