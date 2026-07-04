// The `users/{uid}` repository — web port of iOS
// `Core/Persistence/FirestoreProfileRepository.swift`. Owns document seeding on
// first sign-in (`ensureUserDocument`, design §5), the live decrypted profile
// stream (`streamProfile`), and the goal/streak stats transaction
// (`recordEntrySaved`, design §8). Every field/AAD/wire-shape matches iOS
// byte-for-byte. All reads/writes filter on the caller's own uid — no
// cross-tenant access.

import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  setDoc,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { AAD } from '@/lib/crypto/aad'
import { encryptField } from '@/lib/crypto/envelope'
import { bootstrapDEK, getCachedDEK } from '@/lib/crypto/dek'
import { decodeProfile, decodeStats, encodeStats } from '@/lib/firestore/codec'
import { nextStats } from '@/lib/stats/dailyGoalStreak'
import type { Stats, UserProfile } from '@/lib/firestore/models'

// The seed stats for a brand-new user: all counters zero, no `lastEntryDate` /
// `goalDayDate` (omitted by `encodeStats`).
const DEFAULT_STATS: Stats = {
  streakCount: 0,
  maxStreakCount: 0,
  totalWords: 0,
  goalDayWords: 0,
  promptsAnswered: 0,
}

/**
 * The EXACT `ensureUserDocument` seed map (design §5), matching iOS. Pure and
 * exported so the field set is unit-testable without a live Firestore:
 *   - `displayName`/`email`: auth value or '' (plaintext)
 *   - `biography`: an ENVELOPE of the empty string (encrypted under `dek`)
 *   - `createdAt`: a client `Timestamp` of now (iOS writes `Timestamp(Date())`)
 *   - `timezone`: the browser IANA identifier
 *   - `stats`: `encodeStats(DEFAULT_STATS)` (five zero counters; no dates)
 *   - `storage`: all-zero counters
 *   - `totalMinutesInApp`: 0
 *   - `photoURL`: included ONLY when the auth user has one (never a null)
 * `lastEntryDate`, `goalDayDate`, `dailyPrompt`, `summaryConfig`,
 * `profileDetails` are omitted (never written as nulls).
 */
export const buildUserSeed = async (
  authUser: Pick<User, 'displayName' | 'email' | 'photoURL'>,
  dek: CryptoKey,
): Promise<Record<string, unknown>> => {
  const seed: Record<string, unknown> = {
    displayName: authUser.displayName ?? '',
    email: authUser.email ?? '',
    biography: await encryptField(dek, '', AAD.usersBiography),
    createdAt: Timestamp.fromDate(new Date()),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    stats: encodeStats(DEFAULT_STATS),
    storage: {
      audioBytes: 0,
      audioCount: 0,
      imageBytes: 0,
      imageCount: 0,
      videoBytes: 0,
      videoCount: 0,
    },
    totalMinutesInApp: 0,
  }
  if (authUser.photoURL != null) seed.photoURL = authUser.photoURL
  return seed
}

/**
 * Seed `users/{uid}` on first sign-in. Returns `isNewUser` (true iff the doc
 * did not exist). Existing docs are never overwritten — returning users keep
 * their biography, stats, and any proxy-written fields. Writes with
 * `merge:true` so a concurrent first sign-in (or a proxy write racing the
 * exists-check) can't be clobbered. Requires the DEK (to encrypt the empty
 * biography); bootstraps it if not yet cached.
 */
export const ensureUserDocument = async (): Promise<boolean> => {
  const user = auth.currentUser
  if (!user) throw new Error('ensureUserDocument: no signed-in user')

  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  if (snap.exists()) return false

  const dek = getCachedDEK() ?? (await bootstrapDEK())
  const seed = await buildUserSeed(user, dek)
  await setDoc(ref, seed, { merge: true })
  return true
}

/**
 * Live-stream the decoded profile for `uid`. On each snapshot: if the doc
 * exists, decrypt/decode it (using the cached DEK if present; a best-effort
 * profile is still emitted when the DEK isn't ready yet — `decodeProfile`
 * fail-softs the biography) and call `onData(profile)`; otherwise emit `null`.
 * Returns the unsubscribe function. Decode is async inside the snapshot
 * callback — errors are caught and logged (never dropped), and a null profile
 * is emitted so the stream keeps flowing.
 */
export const streamProfile = (
  uid: string,
  onData: (p: UserProfile | null) => void,
): (() => void) => {
  const ref = doc(db, 'users', uid)
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null)
        return
      }
      const data = snap.data() as DocumentData
      const dek = getCachedDEK()
      if (!dek) {
        // No key yet — bootstrap hasn't finished. Emit null now; the next
        // snapshot (or the one the profile stream re-fires) will decode once
        // the DEK is cached. We never surface undecrypted ciphertext.
        onData(null)
        return
      }
      decodeProfile(uid, data, dek)
        .then((profile) => onData(profile))
        .catch((err) => {
          console.warn(`[profile] failed to decode users/${uid}:`, String(err))
          onData(null)
        })
    },
    (err) => {
      // Keep the stream alive; the listener recovers on the next good snapshot.
      console.warn(`[profile] snapshot listener error (users/${uid}):`, String(err))
    },
  )
}

/**
 * Advance journaling stats after an entry is saved — the goal/streak
 * transaction (design §8), matching iOS `recordEntrySaved`. Reads `stats` and
 * the stored IANA `timezone` (falling back to the browser tz), computes
 * `nextStats`, and writes `{stats}` back with `merge:true`, all inside a single
 * `runTransaction` for read-modify-write safety under concurrent saves.
 *
 * MUST be called AFTER the entry `setDoc` has succeeded. This is best-effort:
 * it PROPAGATES errors so the caller can decide whether to swallow them (the
 * entry is already durable, so a failed stats update is non-fatal).
 */
export const recordEntrySaved = async (
  wordCountDelta: number,
  entryDate: Date,
): Promise<void> => {
  const user = auth.currentUser
  if (!user) throw new Error('recordEntrySaved: no signed-in user')

  const ref = doc(db, 'users', user.uid)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const data = (snap.data() as DocumentData | undefined) ?? {}
    const current = decodeStats(data.stats ?? {})
    const timezone =
      typeof data.timezone === 'string' && data.timezone
        ? data.timezone
        : Intl.DateTimeFormat().resolvedOptions().timeZone
    const next = nextStats(current, wordCountDelta, entryDate, timezone)
    tx.set(ref, { stats: encodeStats(next) }, { merge: true })
  })
}

/**
 * Increment `stats.promptsAnswered` by one — mirrors iOS `recordPromptAnswered`.
 * Runs inside a transaction so it composes safely with `recordEntrySaved`.
 * (M2 text entries aren't prompt-seeded yet; wired for later milestones.)
 */
export const recordPromptAnswered = async (): Promise<void> => {
  const user = auth.currentUser
  if (!user) throw new Error('recordPromptAnswered: no signed-in user')

  const ref = doc(db, 'users', user.uid)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const data = (snap.data() as DocumentData | undefined) ?? {}
    const current = decodeStats(data.stats ?? {})
    const next: Stats = { ...current, promptsAnswered: current.promptsAnswered + 1 }
    tx.set(ref, { stats: encodeStats(next) }, { merge: true })
  })
}
