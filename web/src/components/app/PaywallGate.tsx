'use client'

import { ReactNode } from 'react'
import { useSession } from '@/lib/session/session-context'
import { useEntitlement } from '@/lib/billing/useEntitlement'
import { BILLING_ENABLED } from '@/lib/billing/revenuecat'
import Splash from '@/components/app/Splash'
import SignIn from '@/components/app/SignIn'

// The app-entry gate (design §11, B.5): loading -> splash, signedOut -> sign
// in, signedIn -> the gate's own checking/locked/unlocked states.
//
// Behind the BILLING_ENABLED kill-switch (server/env-driven, see
// lib/billing/revenuecat.ts): while billing is off, the app stays open
// exactly as shipped pre-paywall. When billing is on, the real RevenueCat
// `pro` entitlement (useEntitlement) gates access.
export default function PaywallGate({ children }: { children: ReactNode }) {
  const { phase, uid } = useSession()
  const ent = useEntitlement(uid)

  if (phase === 'loading') return <Splash />
  if (phase === 'signedOut') return <SignIn />

  // Kill-switch: until billing launches, keep the app open (matches shipped state).
  if (!BILLING_ENABLED) return <>{children}</>

  if (ent.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--bg)' }}>
        <span
          className="inline-block h-6 w-6 animate-spin rounded-full border-2"
          style={{ borderColor: 'var(--hairline2)', borderTopColor: 'var(--accent)' }}
        />
      </div>
    )
  }

  if (ent.status === 'inactive') {
    // Non-dismissible Pro paywall shell (design B.5).
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
        <a href="/founding" className="btn-amber">
          See plans
        </a>
      </div>
    )
  }

  return <>{children}</>
}
