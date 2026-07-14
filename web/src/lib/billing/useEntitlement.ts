'use client'
import { useEffect, useState } from 'react'
import { getPurchases, PRO_ENTITLEMENT_ID } from './revenuecat'

export type Entitlement = { status: 'loading' | 'active' | 'inactive' }

/** Reads the `pro` entitlement from the RevenueCat Web SDK for the signed-in uid. */
export function useEntitlement(uid: string | null): Entitlement {
  const [status, setStatus] = useState<Entitlement['status']>('loading')
  useEffect(() => {
    if (!uid) { setStatus('loading'); return }
    let cancelled = false
    ;(async () => {
      try {
        const purchases = await getPurchases(uid)
        const info = await purchases.getCustomerInfo()
        const active = !!info?.entitlements?.active?.[PRO_ENTITLEMENT_ID]
        if (!cancelled) setStatus(active ? 'active' : 'inactive')
      } catch {
        if (!cancelled) setStatus('inactive') // fail-closed for gating; UI may retry
      }
    })()
    return () => { cancelled = true }
  }, [uid])
  return { status }
}
