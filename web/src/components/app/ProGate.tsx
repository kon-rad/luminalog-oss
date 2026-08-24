'use client'

import { ReactNode } from 'react'
import { useSession } from '@/lib/session/session-context'
import { useEntitlement } from '@/lib/billing/useEntitlement'
import { BILLING_ENABLED } from '@/lib/billing/revenuecat'
import SubscribeButton from '@/components/app/SubscribeButton'

// Per-surface Pro gate (design §2). Replaces PaywallGate's whole-app lock: the
// web tier is freemium, so writing, reading, media and keyword search stay open
// and only the AI surfaces (chat, insights, daily prompt, semantic search, the
// cognitive map) sit behind this.
//
// This is UI only. Enforcement lives in the server's `requirePro` middleware,
// which is what actually protects the LLM spend; a gate that runs in the
// viewer's browser can always be stepped around. Keeping the client gate anyway
// is what makes the product legible: people should see what Pro unlocks rather
// than meeting a 402 in a console.
//
// Entitlement is read from the RevenueCat Web SDK rather than from the server's
// /v1/entitlement, on purpose. The SDK resolves the instant an in-page purchase
// completes, while the Firestore doc the server reads only updates when the
// webhook lands a second or two later. Letting the UI run ahead is what makes
// checkout feel immediate; the server's self-heal covers the gap.

interface ProGateProps {
  children: ReactNode
  /** Name of the locked surface, e.g. "Chat". Used in the upsell copy. */
  feature: string
  /** One line on what this feature does, shown under the heading. */
  blurb?: string
  /** Render nothing at all when locked, instead of the upsell card. */
  silent?: boolean
}

export default function ProGate({ children, feature, blurb, silent = false }: ProGateProps) {
  const { uid } = useSession()
  const ent = useEntitlement(BILLING_ENABLED ? uid : null)

  // Kill-switch: while billing is off the whole app behaves exactly as shipped.
  if (!BILLING_ENABLED) return <>{children}</>

  // Render children while resolving rather than flashing an upsell at a
  // subscriber on every navigation. The server is the real gate, so an
  // optimistic moment here costs nothing.
  if (ent.status === 'loading' || ent.status === 'active') return <>{children}</>

  if (silent) return null

  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-2xl px-6 py-10 text-center"
      style={{ background: 'var(--surface2, transparent)', border: '1px solid var(--hairline2)' }}
    >
      <p className="serif text-xl font-semibold" style={{ color: 'var(--text)' }}>
        {feature} is part of Argo Pro
      </p>
      <p className="max-w-sm text-sm" style={{ color: 'var(--text2)' }}>
        {blurb ?? 'Your journal stays free. Pro adds the AI that reads it back to you.'}
      </p>
      <SubscribeButton plan="$rc_monthly" label="Upgrade to Pro" />
      <a href="/pricing" className="text-sm underline" style={{ color: 'var(--text2)' }}>
        See plans
      </a>
    </div>
  )
}
