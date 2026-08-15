// DEK (data encryption key) lifecycle: the in-memory cache of the user's raw
// 32-byte AES-256 key, imported as a non-extractable WebCrypto AES-GCM key. No
// KDF and no salt, because the raw 32 bytes ARE the AES-256 key (matching iOS
// `SymmetricKey(data:)`).
//
// The key arrives ONLY from `installDEK`, called by `keys/keyEnrollment.ts`
// after unwrapping a client-held wrap (the recovery code, or this browser's
// local slot). The old server-held path, `POST /v1/keys/bootstrap`, was deleted
// at the zero-knowledge cutover: the server holds none of the KEKs and can no
// longer produce a DEK for anyone.

let cachedDEK: CryptoKey | null = null

// Bumped by `clearDEK()` (sign-out). An install in flight when a sign-out
// happens captures its own generation first; if the generation has moved on by
// the time the import resolves, the (now stale, wrong-user) key is returned to
// the caller but NOT written into the shared `cachedDEK`. That closes a
// cross-user key contamination window: install in flight, then sign-out, then a
// different user signs in, then the stale import resolves and would otherwise
// re-poison the cache.
let generation = 0

/**
 * Import raw DEK bytes as the session key. The ONLY way a key enters the cache
 * now that `/bootstrap` is gone: callers obtain the bytes by unwrapping a
 * client-held wrap (recovery code or browser slot) and hand them here.
 *
 * Imported non-extractable, so the key cannot be read back out of the browser
 * even by this app's own code.
 */
export async function installDEK(bytes: Uint8Array): Promise<CryptoKey> {
  if (bytes.length !== 32) {
    throw new Error(`installDEK: expected a 32-byte key, got ${bytes.length} bytes`)
  }
  const gen = generation
  const key = await crypto.subtle.importKey(
    'raw',
    bytes as Uint8Array<ArrayBuffer>,
    'AES-GCM',
    /* extractable */ false,
    ['encrypt', 'decrypt'],
  )
  // Never poison the shared cache with a key belonging to a user who signed
  // out while this import was in flight (see `generation` above).
  if (gen === generation) cachedDEK = key
  return key
}

/** The in-memory DEK, or null if no key has been installed this session. */
export function getCachedDEK(): CryptoKey | null {
  return cachedDEK
}

/** Drops the in-memory DEK. Call on sign-out. */
export function clearDEK(): void {
  generation++
  cachedDEK = null
}
