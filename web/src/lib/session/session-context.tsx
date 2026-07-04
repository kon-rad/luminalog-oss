'use client'

// Session bootstrap orchestrator — web port of iOS `SessionStore.swift`
// (`Core/Auth/SessionStore.swift`). Consumes `useAuth()` (the raw Firebase
// auth-state stream) and runs the EXACT bootstrap order from design §5 on
// every *new* signed-in uid (deduping repeat emissions of the same uid, e.g.
// token refreshes):
//
//   1. bootstrapDEK()               — load the encryption key FIRST (failure
//                                      is logged, not fatal — repos fail closed).
//   2. set phase 'signedIn' + uid
//   3. ensureUserDocument()         — seeds users/{uid} on first sign-in.
//   4. set isNewUser = created
//   5. mergeOnboardingDraft()       — TODO(onboarding): no-op stub for M2; a
//                                      later milestone replaces this with the
//                                      real draft-merge hook.
//   6. streamProfile(uid, ...)      — start the live decrypted profile stream;
//                                      keep the unsubscribe to tear down later.
//
// On sign-out (user -> null after having been signed in): clearDEK(), stop the
// profile stream, reset profile/isNewUser, phase 'signedOut'.

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { useAuth } from '@/lib/auth-context'
import { bootstrapDEK, clearDEK } from '@/lib/crypto/dek'
import { ensureUserDocument, streamProfile } from '@/lib/firestore/profile'
import type { UserProfile } from '@/lib/firestore/models'

export type SessionPhase = 'loading' | 'signedOut' | 'signedIn'

interface SessionContextType {
  phase: SessionPhase
  uid: string | null
  isNewUser: boolean
  profile: UserProfile | null
}

const SessionContext = createContext<SessionContextType>({
  phase: 'loading',
  uid: null,
  isNewUser: false,
  profile: null,
})

/**
 * TODO(onboarding): placeholder for the onboarding-draft merge hook (design §5
 * step 5 / iOS `mergeOnboardingDraftIfPresent`). Onboarding capture itself is a
 * later milestone — this no-op keeps the bootstrap ORDER correct now so wiring
 * in the real merge later doesn't require reshuffling the sequence.
 */
async function mergeOnboardingDraft(_uid: string, _isNewUser: boolean): Promise<void> {
  return
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const [phase, setPhase] = useState<SessionPhase>('loading')
  const [uid, setUid] = useState<string | null>(null)
  const [isNewUser, setIsNewUser] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)

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
      setUid(null)
      setIsNewUser(false)
      setProfile(null)
      setPhase('signedOut')
      return
    }

    // New signed-in uid — run the bootstrap in order. Guard against races: if
    // the effect re-runs (a different uid arrives) before this finishes, drop
    // the stale results instead of applying them.
    bootstrappedUid.current = nextUid
    let cancelled = false

    const run = async () => {
      // 1. Load the DEK before any encrypted Firestore read/write. Not fatal —
      // repositories fail closed until the key becomes available.
      try {
        await bootstrapDEK()
      } catch (err) {
        console.error('[session] bootstrapDEK failed:', err)
      }
      if (cancelled) return

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
  }, [user, loading])

  // Tear down the profile stream on unmount.
  useEffect(() => {
    return () => {
      unsubscribeProfile.current?.()
      unsubscribeProfile.current = null
    }
  }, [])

  return (
    <SessionContext.Provider value={{ phase, uid, isNewUser, profile }}>
      {children}
    </SessionContext.Provider>
  )
}

export const useSession = () => useContext(SessionContext)
