import { apiPost } from '../api/client'

// DEK (data encryption key) lifecycle. Bootstraps the user's raw 32-byte AES-256
// key from the server (`POST /v1/keys/bootstrap` via the same-origin proxy),
// imports it as a non-extractable WebCrypto AES-GCM key, and caches it in
// memory for the session. No KDF/salt — the raw 32 bytes are the AES-256 key
// directly (matches iOS `SymmetricKey(data:)`).

let cachedDEK: CryptoKey | null = null

// Bumped by `clearDEK()` (sign-out). A bootstrap in flight when a sign-out
// happens captures its own generation before the fetch; if the generation has
// moved on by the time the fetch resolves, the (now stale/wrong-user) key is
// returned to the caller but NOT written into the shared `cachedDEK` — closes
// a cross-user key contamination window (bootstrap in flight → sign-out →
// different user signs in → stale fetch resolves and would otherwise
// re-poison the cache).
let generation = 0

// Tiny atob-based base64 decoder (works in browser + node/vitest).
function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Returns the cached DEK, bootstrapping it from the server on first call. */
export async function bootstrapDEK(): Promise<CryptoKey> {
  if (cachedDEK) return cachedDEK

  const gen = generation
  const { dek } = await apiPost<{ dek: string }>('/api/keys/bootstrap', {})
  const bytes = base64ToBytes(dek)
  if (bytes.length !== 32) {
    throw new Error(`bootstrapDEK: expected a 32-byte key, got ${bytes.length} bytes`)
  }

  const key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', /* extractable */ false, [
    'encrypt',
    'decrypt',
  ])
  // Only poison the shared cache if no sign-out happened while we were
  // awaiting the network — otherwise a stale/wrong-user key could survive a
  // `clearDEK()` and leak into a subsequently signed-in user's session. The
  // caller still gets `key` back for whatever operation is in flight.
  if (gen === generation) cachedDEK = key
  return key
}

/** The in-memory DEK, or null if not yet bootstrapped this session. */
export function getCachedDEK(): CryptoKey | null {
  return cachedDEK
}

/** Drops the in-memory DEK. Call on sign-out. */
export function clearDEK(): void {
  generation++
  cachedDEK = null
}
