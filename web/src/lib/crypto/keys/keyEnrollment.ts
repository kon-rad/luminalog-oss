import { installDEK } from '@/lib/crypto/dek'
import { unwrap, wrap } from '@/lib/crypto/wrappedKey'
import { clearSlot, loadSlot, requestPersistence, saveSlot } from './browserSlot'
import { deriveKEK, generate } from './recoveryCode'
import { fetchWraps, uploadWraps } from './wrapTransport'

// Web port of iOS `Core/Crypto/KeyEnrollmentService.swift`: resolves the
// per-user DEK at sign-in, enrolls a brand-new account that has none, and falls
// back to the recovery code when this browser holds no key.
//
// The browser has exactly one door into the zero-knowledge key store. The other
// wrap slot is an iCloud Keychain key, which no browser can reach, so the
// recovery code is not a fallback here: it is the primary path.
//
// ORDERING IS THE SAFETY PROPERTY, exactly as on iOS: a DEK is installed only
// after its wraps are uploaded AND verified, so a user can never encrypt data
// with a key that has no durable backup.

/** Where the signed-in user stands with respect to their encryption key. */
export type KeyState =
  /** Work in flight. */
  | { kind: 'resolving' }
  /** The DEK is installed; the app may read and write. */
  | { kind: 'unlocked' }
  /** Freshly enrolled. The code is shown exactly once and stored nowhere, so
   *  the user must acknowledge it before proceeding. */
  | { kind: 'showingRecoveryCode'; code: string }
  /** The account has wraps but this browser holds no key that opens them. */
  | { kind: 'needsRecoveryCode'; failedAttempt: boolean }
  /** Pre-migration account: the server still holds the legacy wrappedDEK and
   *  only the iOS app can complete the migration. Web-only state. */
  | { kind: 'needsIOSSetup' }
  /** Transient failure (offline, storage error). Retryable, never destructive. */
  | { kind: 'failed'; message: string }

const NETWORK_FAILURE = 'Could not reach your encryption keys. Please try again.'

/** Constant-time-ish byte comparison. Length is not secret here. */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/** Enroll a brand-new account: generate, upload, VERIFY, then install. */
async function enroll(uid: string): Promise<KeyState> {
  const dekBytes = crypto.getRandomValues(new Uint8Array(32))
  const code = generate()
  const kek = await deriveKEK(code)

  await uploadWraps({ recovery: await wrap(kek, dekBytes) })

  // VERIFY GATE. Re-fetch and prove the stored wrap recovers this exact DEK
  // before the key is installed anywhere. Mirrors ClientKeyEnroller.enroll.
  const stored = (await fetchWraps()).wrappedKeys.recovery
  if (!stored) {
    return { kind: 'failed', message: 'Could not save your recovery key. Please try again.' }
  }
  let roundTripped: Uint8Array
  try {
    roundTripped = await unwrap(await deriveKEK(code), stored)
  } catch {
    return { kind: 'failed', message: 'Key safety check failed; nothing was changed.' }
  }
  if (!bytesEqual(roundTripped, dekBytes)) {
    return { kind: 'failed', message: 'Key safety check failed; nothing was changed.' }
  }

  await installDEK(dekBytes)
  await saveSlot(uid, dekBytes)
  await requestPersistence()
  return { kind: 'showingRecoveryCode', code }
}

/**
 * Resolve the DEK for `uid`. Checks the browser slot first, so the common case
 * costs no network round trip.
 *
 * `hasLegacyWrappedDEK` is injected rather than imported so this module stays
 * free of Firestore: `GET /v1/keys/wrapped` returns only `wrappedKeys`, so it
 * cannot on its own tell a brand-new account from a pre-migration one.
 */
export async function resolveKey(
  uid: string,
  hasLegacyWrappedDEK: () => Promise<boolean>,
): Promise<KeyState> {
  try {
    const cached = await loadSlot(uid)
    if (cached) {
      await installDEK(cached)
      return { kind: 'unlocked' }
    }

    const { wrappedKeys } = await fetchWraps()
    if (wrappedKeys.recovery) return { kind: 'needsRecoveryCode', failedAttempt: false }

    // No recovery wrap. Either a pre-migration account (iOS must finish it) or
    // a brand-new one (enroll here).
    if (await hasLegacyWrappedDEK()) return { kind: 'needsIOSSetup' }

    return await enroll(uid)
  } catch (err) {
    console.error('[keys] resolveKey failed:', err)
    return { kind: 'failed', message: NETWORK_FAILURE }
  }
}

/**
 * Unlock with a typed recovery code. A wrong code fails on the AES-GCM
 * authentication tag, which is a clean fail-closed with no oracle.
 *
 * Deliberately performs NO re-enrollment. iOS re-binds a fresh iCloud KEK when
 * unlocking on a new device; the browser has no server-side slot of its own, so
 * it leaves `wrappedKeys` untouched. Fewer writes, nothing to clobber.
 */
export async function unlockWithRecoveryCode(
  uid: string,
  code: string,
  remember: boolean,
): Promise<KeyState> {
  let env
  try {
    env = (await fetchWraps()).wrappedKeys.recovery
  } catch (err) {
    // A network failure must NOT be reported as a bad code. Telling a user
    // their correct code is wrong is the worst available message here.
    console.error('[keys] unlockWithRecoveryCode could not fetch wraps:', err)
    return { kind: 'failed', message: NETWORK_FAILURE }
  }
  if (!env) return { kind: 'needsRecoveryCode', failedAttempt: true }

  let dekBytes: Uint8Array
  try {
    dekBytes = await unwrap(await deriveKEK(code), env)
  } catch {
    // Wrong code. Indistinguishable from tampering by design.
    return { kind: 'needsRecoveryCode', failedAttempt: true }
  }

  try {
    await installDEK(dekBytes)
  } catch (err) {
    console.error('[keys] installDEK failed after a successful unwrap:', err)
    return { kind: 'failed', message: NETWORK_FAILURE }
  }

  // Slot writes are best-effort by contract (saveSlot never throws), so a
  // browser that refuses storage still ends up unlocked for this session.
  if (remember) {
    await saveSlot(uid, dekBytes)
    await requestPersistence()
  } else {
    await clearSlot(uid)
  }
  return { kind: 'unlocked' }
}
