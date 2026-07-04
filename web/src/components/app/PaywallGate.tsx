'use client'

import { ReactNode } from 'react'
import { useSession } from '@/lib/session/session-context'
import Splash from '@/components/app/Splash'
import SignIn from '@/components/app/SignIn'

// The app-entry gate (design §11, B.5): loading -> splash, signedOut -> sign
// in, signedIn -> the gate's own checking/locked/unlocked states.
//
// TODO(paywall): M1 stubs entitlement to always 'unlocked' (real Pro
// entitlement + fail-open is a later milestone, M7). The three-state shell is
// kept so M7 only has to swap `entitlement`'s source (e.g. a RevenueCat/Stripe
// hook) for the hard-coded value below — nothing else here should need to
// change.
type Entitlement = 'checking' | 'locked' | 'unlocked'

// TODO(paywall): replace with the real entitlement check (RevenueCat/Stripe,
// M7). Wrapped in a function (rather than an inline literal) so this is the
// only place that needs to change — an inline `const x: Entitlement =
// 'unlocked'` narrows to the literal type and defeats the switch below.
function currentEntitlement(): Entitlement {
  return 'unlocked'
}

export default function PaywallGate({ children }: { children: ReactNode }) {
  const { phase } = useSession()

  if (phase === 'loading') return <Splash />
  if (phase === 'signedOut') return <SignIn />

  // phase === 'signedIn'
  const entitlement: Entitlement = currentEntitlement()

  if (entitlement === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--bg)' }}>
        <span
          className="inline-block h-6 w-6 animate-spin rounded-full border-2"
          style={{ borderColor: 'var(--hairline2)', borderTopColor: 'var(--accent)' }}
        />
      </div>
    )
  }

  if (entitlement === 'locked') {
    // Dead code for now — the non-dismissible Pro paywall shell (design B.5).
    // Kept minimal/unreachable until M7 wires the real entitlement source.
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center"
        style={{ background: 'var(--bg)' }}
      >
        <p className="serif text-2xl font-semibold" style={{ color: 'var(--text)' }}>
          LuminaLog Pro
        </p>
        <p className="max-w-sm" style={{ color: 'var(--text2)' }}>
          Unlimited insights, prompts, chat, and voice — your whole journal, always with you.
        </p>
        <button type="button" className="btn-amber">
          Continue
        </button>
        <button type="button" className="text-sm" style={{ color: 'var(--text3)' }}>
          Sign out
        </button>
      </div>
    )
  }

  return <>{children}</>
}
