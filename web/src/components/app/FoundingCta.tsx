'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSession } from '@/lib/session/session-context'
import { getPurchases, BILLING_ENABLED } from '@/lib/billing/revenuecat'

// Founding-offer CTA (design: /founding offer card). Client island so
// `founding/page.tsx` can stay a server component with `metadata`.
//
// BILLING_ENABLED === false (shipped/production default): renders the exact
// "Coming soon" pill + waitlist paragraph that shipped pre-billing — copied
// verbatim from the old inline markup in founding/page.tsx so the flag-off
// experience is byte-for-byte unchanged.
//
// BILLING_ENABLED === true: a real RevenueCat Web Billing purchase for the
// `founding` offering (see lib/billing/revenuecat.ts for the BILLING_ENABLED
// kill-switch and getPurchases()). Verified against the installed
// @revenuecat/purchases-js types (dist/Purchases.es.d.ts): `getOfferings()`
// returns `Offerings { all: Record<string, Offering>, current: Offering | null }`,
// `Offering.availablePackages: Package[]`, and `purchase(params: PurchaseParams)`
// takes `{ rcPackage: Package }` — matches this implementation as written.
const COMING_SOON = (
  <>
    <span
      aria-disabled="true"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 9,
        background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.4)',
        color: '#fff', fontSize: 17, fontWeight: 700, padding: '15px 34px',
        borderRadius: 15, cursor: 'default', whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
      Coming soon
    </span>
    <p style={{ marginTop: 18, fontSize: 14, color: 'rgba(255,255,255,0.75)' }}>
      Founding checkout opens shortly.{' '}
      <Link href="/#waitlist" style={{ color: '#fff', fontWeight: 600, textDecoration: 'underline' }}>
        Join the waitlist
      </Link>{' '}
      to be first in line.
    </p>
  </>
)

export default function FoundingCta() {
  const { phase, uid } = useSession()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!BILLING_ENABLED) return COMING_SOON

  async function buy() {
    if (!uid) {
      window.location.href = '/#waitlist' // not signed in — send to sign-in/waitlist
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const purchases = await getPurchases(uid)
      const offerings = await purchases.getOfferings()
      const founding = offerings.all['founding'] ?? offerings.current
      const pkg = founding?.availablePackages?.[0]
      if (!pkg) throw new Error('Founding offer unavailable')
      await purchases.purchase({ rcPackage: pkg })
      window.location.href = '/dashboard?founding=welcome'
    } catch (e: any) {
      setErr(e?.message ?? 'Something went wrong — please try again.')
      setBusy(false)
    }
  }

  return (
    <>
      <button
        onClick={buy}
        disabled={busy || phase === 'loading'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 9,
          background: '#fff', color: 'var(--accentDeep)', fontSize: 17, fontWeight: 700,
          padding: '15px 34px', borderRadius: 15, border: 'none',
          cursor: busy ? 'default' : 'pointer', whiteSpace: 'nowrap', opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? 'Opening checkout…' : 'Become a Founding Member →'}
      </button>
      {err && <p style={{ marginTop: 12, fontSize: 14, color: '#fff' }}>{err}</p>}
    </>
  )
}
