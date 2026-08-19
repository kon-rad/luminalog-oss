'use client'

import { ReactNode } from 'react'
import { useSession } from '@/lib/session/session-context'
import Splash from '@/components/app/Splash'
import RecoveryCodeSetup from './RecoveryCodeSetup'
import RecoveryCodeUnlock from './RecoveryCodeUnlock'

// Gates every authenticated route on the encryption key.
//
// Without a DEK, every content path fails closed: reads yield nothing and
// writes throw. Rendering the app anyway would show a signed-in user an empty
// journal, which is indistinguishable from data loss. This gate is what turns
// that silence into a diagnosis.
//
// Mounted INSIDE PaywallGate, which has already resolved loading and signed-out,
// so `keyState` here always belongs to a signed-in user.
export default function KeyUnlockGate({ children }: { children: ReactNode }) {
  const { keyState, unlockWithCode, acknowledgeRecoveryCode, retryKeyResolve } = useSession()

  switch (keyState.kind) {
    case 'resolving':
      return <Splash />

    case 'unlocked':
      return <>{children}</>

    case 'showingRecoveryCode':
      return <RecoveryCodeSetup code={keyState.code} onAcknowledged={acknowledgeRecoveryCode} />

    case 'needsRecoveryCode':
      return <RecoveryCodeUnlock failedAttempt={keyState.failedAttempt} onSubmit={unlockWithCode} />

    case 'needsIOSSetup':
      return (
        <div
          className="flex min-h-screen items-center justify-center px-4 py-10"
          style={{ background: 'var(--bg)' }}
        >
          <div className="w-full max-w-md text-center">
            <h1 className="serif mb-3 text-2xl font-semibold" style={{ color: 'var(--text)' }}>
              Finish setup on your iPhone
            </h1>
            <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>
              This account was created before Argo moved to keys only you hold. Open Argo on your
              iPhone once and it will finish setting up your encryption and give you a recovery
              code. Then come back here and enter it.
            </p>
          </div>
        </div>
      )

    case 'failed':
      return (
        <div
          className="flex min-h-screen items-center justify-center px-4 py-10"
          style={{ background: 'var(--bg)' }}
        >
          <div className="w-full max-w-sm text-center">
            <p className="serif mb-4 text-lg" style={{ color: 'var(--text)' }}>
              {keyState.message}
            </p>
            <button type="button" onClick={retryKeyResolve} className="btn-amber-full">
              Try again
            </button>
          </div>
        </div>
      )
  }
}
