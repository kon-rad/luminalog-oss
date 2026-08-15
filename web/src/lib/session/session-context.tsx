'use client'

// Session bootstrap orchestrator, web port of iOS `SessionStore.swift`
// (`Core/Auth/SessionStore.swift`). Consumes `useAuth()` (the raw Firebase
// auth-state stream) and runs the bootstrap order from design §5 on every *new*
// signed-in uid (deduping repeat emissions of the same uid, e.g. token
// refreshes):
//
//   1. resolveKey()                 - resolve the encryption key FIRST. This is
//                                     a GATE, not a best-effort step: every
//                                     content path fails closed without a DEK,
//                                     so rendering on past a failure would show
//                                     a signed-in user an empty journal.
//   2. set phase 'signedIn' + uid
//   3. ensureUserDocument()         - seeds users/{uid} on first sign-in.
//   4. set isNewUser = created
//   5. mergeOnboardingDraft()       - no-op stub for M2; a later milestone
//                                     replaces this with the real merge hook.
//   6. streamProfile(uid, ...)      - start the live decrypted profile stream;
//                                     keep the unsubscribe to tear down later.
//
// Steps 3 to 6 still run while the key is locked: the user has a valid auth
// session either way, seeding their document is harmless, and `decodeProfile`
// already fail-softs without a DEK. Only rendering is gated, by `KeyUnlockGate`.
//
// On sign-out (user -> null after having been signed in): clearDEK(), reset the
// key state, stop the profile stream, reset profile/isNewUser, phase
// 'signedOut'. The browser key SLOT deliberately survives sign-out: it is keyed
// by uid and only reachable after Firebase auth for that same uid, so an
// attacker needs the account before it is worth anything. `forgetThisBrowser`
// is the explicit escape hatch.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { clearDEK } from '@/lib/crypto/dek'
import { clearSlot } from '@/lib/crypto/keys/browserSlot'
import {
  resolveKey,
  unlockWithRecoveryCode,
  type KeyState,
} from '@/lib/crypto/keys/keyEnrollment'
import { ensureUserDocument, streamProfile } from '@/lib/firestore/profile'
import type { UserProfile } from '@/lib/firestore/models'

export type SessionPhase = 'loading' | 'signedOut' | 'signedIn'

interface SessionContextType {
  phase: SessionPhase
  uid: string | null
  isNewUser: boolean
  profile: UserProfile | null
  keyState: KeyState
  unlockWithCode: (code: string, remember: boolean) => Promise<void>
  acknowledgeRecoveryCode: () => void
  retryKeyResolve: () => void
  forgetThisBrowser: () => Promise<void>
}

const SessionContext = createContext<SessionContextType>({
  phase: 'loading',
  uid: null,
  isNewUser: false,
  profile: null,
  keyState: { kind: 'resolving' },
  unlockWithCode: async () => {},
  acknowledgeRecoveryCode: () => {},
  retryKeyResolve: () => {},
  forgetThisBrowser: async () => {},
})

/**
 * TODO(onboarding): placeholder for the onboarding-draft merge hook (design §5
 * step 5 / iOS `mergeOnboardingDraftIfPresent`). Onboarding capture itself is a
 * later milestone. This no-op keeps the bootstrap ORDER correct now so wiring
 * in the real merge later does not require reshuffling the sequence.
 */
async function mergeOnboardingDraft(_uid: string, _isNewUser: boolean): Promise<void> {
  return
}

/**
 * True when this account still holds the pre-cutover, server-wrapped DEK.
 *
 * `GET /v1/keys/wrapped` returns only `wrappedKeys`, so it cannot tell a
 * brand-new account from a pre-migration one. This read can. A missing document
 * means brand new, which is the safe reading: enrollment then creates one.
 */
async function hasLegacyWrappedDEK(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    return snap.exists() && snap.get('wrappedDEK') !== undefined
  } catch (err) {
    console.error('[session] legacy wrappedDEK probe failed:', err)
    return false
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const [phase, setPhase] = useState<SessionPhase>('loading')
  const [uid, setUid] = useState<string | null>(null)
  const [isNewUser, setIsNewUser] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [keyState, setKeyState] = useState<KeyState>({ kind: 'resolving' })
  // Bumped by `retryKeyResolve` to re-run the bootstrap without disturbing the
  // auth stream.
  const [keyNonce, setKeyNonce] = useState(0)

  // Tracks the uid we've already bootstrapped, so repeat emissions of the same
  // signed-in user (token refreshes) don't re-run the bootstrap sequence.
  const bootstrappedUid = useRef<string | null>(null)
  // Unsubscribe handle for the live profile stream, torn down on uid change /
  // sign-out.
  const unsubscribeProfile = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (loading) {
      setPhase('loading')
      return
    }

    const nextUid = user?.uid ?? null

    // No-op: same uid we already bootstrapped (e.g. a token-refresh emission).
    // `retryKeyResolve` clears `bootstrappedUid` first, so a retry gets through.
    if (nextUid && nextUid === bootstrappedUid.current) return
    // No-op: already signed out and still signed out.
    if (!nextUid && bootstrappedUid.current === null) return

    // Tear down any previous profile stream before switching users.
    unsubscribeProfile.current?.()
    unsubscribeProfile.current = null

    if (!nextUid) {
      // Sign-out transition.
      bootstrappedUid.current = null
      clearDEK()
      setKeyState({ kind: 'resolving' })
      setUid(null)
      setIsNewUser(false)
      setProfile(null)
      setPhase('signedOut')
      return
    }

    // New signed-in uid: run the bootstrap in order. Guard against races: if
    // the effect re-runs (a different uid arrives) before this finishes, drop
    // the stale results instead of applying them.
    bootstrappedUid.current = nextUid
    let cancelled = false

    const run = async () => {
      // 1. Resolve the encryption key BEFORE any encrypted read or write.
      setKeyState({ kind: 'resolving' })
      const resolved = await resolveKey(nextUid, () => hasLegacyWrappedDEK(nextUid))
      if (cancelled) return
      setKeyState(resolved)

      // 2. Signed-in state.
      setUid(nextUid)
      setPhase('signedIn')

      // 3. Seed users/{uid} on first sign-in.
      let created = false
      try {
        created = await ensureUserDocument()
      } catch (err) {
        console.error('[session] ensureUserDocument failed:', err)
      }
      if (cancelled) return

      // 4. isNewUser.
      setIsNewUser(created)

      // 5. TODO(onboarding): merge the draft (no-op stub in M2).
      try {
        await mergeOnboardingDraft(nextUid, created)
      } catch (err) {
        console.error('[session] mergeOnboardingDraft failed:', err)
      }
      if (cancelled) return

      // 6. Start the live profile stream.
      unsubscribeProfile.current = streamProfile(nextUid, setProfile)
    }

    run()

    return () => {
      cancelled = true
    }
  }, [user, loading, keyNonce])

  // Tear down the profile stream on unmount.
  useEffect(() => {
    return () => {
      unsubscribeProfile.current?.()
      unsubscribeProfile.current = null
    }
  }, [])

  const unlockWithCode = useCallback(
    async (code: string, remember: boolean) => {
      if (!uid) return
      setKeyState(await unlockWithRecoveryCode(uid, code, remember))
    },
    [uid],
  )

  // The freshly enrolled user has confirmed they saved their code. The DEK was
  // already installed by `resolveKey`, so this only advances the gate.
  const acknowledgeRecoveryCode = useCallback(() => {
    setKeyState({ kind: 'unlocked' })
  }, [])

  // Clear the same-uid guard so the effect re-runs, then bump the nonce to
  // trigger it. Without clearing the guard the retry would short-circuit.
  const retryKeyResolve = useCallback(() => {
    bootstrappedUid.current = null
    setKeyNonce((n) => n + 1)
  }, [])

  const forgetThisBrowser = useCallback(async () => {
    if (!uid) return
    await clearSlot(uid)
  }, [uid])

  return (
    <SessionContext.Provider
      value={{
        phase,
        uid,
        isNewUser,
        profile,
        keyState,
        unlockWithCode,
        acknowledgeRecoveryCode,
        retryKeyResolve,
        forgetThisBrowser,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export const useSession = () => useContext(SessionContext)
