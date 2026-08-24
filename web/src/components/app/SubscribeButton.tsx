'use client'

import { useState } from 'react'
import { useSession } from '@/lib/session/session-context'
import { getPurchases, BILLING_ENABLED, PRO_ENTITLEMENT_ID } from '@/lib/billing/revenuecat'

// In-page RevenueCat Web Billing checkout (design §2). Grew out of the old
// FoundingCta island, which was written for the founding preorder and then left
// unimported when that sale moved to a raw Stripe Payment Link; the purchase
// flow it contained was correct, so it is reused here rather than rewritten.
//
// Verified against the installed @revenuecat/purchases-js types
// (dist/Purchases.es.d.ts): `getOfferings()` returns `Offerings { all, current }`,
// `Offering.availablePackages: Package[]`, and `purchase(params: PurchaseParams)`
// takes `{ rcPackage: Package }`.
//
// BILLING_ENABLED === false (the production default until the RevenueCat
// dashboard is configured) renders nothing at all, so a half-configured deploy
// shows no dead checkout button.

export type PlanId = '$rc_monthly' | '$rc_annual'

interface SubscribeButtonProps {
  /** RevenueCat package identifier within the `default` offering. */
  plan: PlanId
  label: string
  className?: string
  /** Where to land after a successful purchase. */
  successPath?: string
}

export default function SubscribeButton({
  plan,
  label,
  className = 'btn-amber',
  successPath = '/home',
}: SubscribeButtonProps) {
  const { uid } = useSession()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!BILLING_ENABLED) return null

  async function buy() {
    if (!uid) {
      // Checkout needs a Firebase uid: it is the RevenueCat App User ID, and it
      // is what makes the purchase resolve on iOS too. Sign in first.
      window.location.href = '/home'
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const purchases = await getPurchases(uid)
      const info = await purchases.getCustomerInfo()
      if (info?.entitlements?.active?.[PRO_ENTITLEMENT_ID]) {
        // Already Pro (possibly bought on iOS): never double-charge.
        window.location.href = successPath
        return
      }
      const offerings = await purchases.getOfferings()
      const offering = offerings.current ?? offerings.all['default']
      const pkg = offering?.availablePackages?.find((p) => p.identifier === plan)
      if (!pkg) throw new Error('That plan is unavailable right now.')
      await purchases.purchase({ rcPackage: pkg })
      window.location.href = successPath
    } catch (e: unknown) {
      setErr((e as Error)?.message ?? 'Something went wrong, please try again.')
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" onClick={buy} disabled={busy} className={className}>
        {busy ? 'Opening checkout...' : label}
      </button>
      {err && (
        <p role="alert" style={{ marginTop: 12, fontSize: 14, color: 'var(--danger, #b4462f)' }}>
          {err}
        </p>
      )}
    </>
  )
}
