'use client'
import { useEffect, useState } from 'react'
import { getPurchases, PRO_ENTITLEMENT_ID } from './revenuecat'
import type { EntitlementStore } from './manage'

export type Entitlement = {
  status: 'loading' | 'active' | 'inactive'
  /** Which rail billed the subscription. Decides where "Manage" sends them. */
  store: EntitlementStore
  /** RevenueCat's management link, or null when there is nothing to manage. */
  managementURL: string | null
}

/** Reads the `pro` entitlement from the RevenueCat Web SDK for the signed-in uid. */
export function useEntitlement(uid: string | null): Entitlement {
  const [ent, setEnt] = useState<Entitlement>({
    status: 'loading',
    store: 'unknown',
    managementURL: null,
  })
  useEffect(() => {
    if (!uid) {
      setEnt({ status: 'loading', store: 'unknown', managementURL: null })
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const purchases = await getPurchases(uid)
        const info = await purchases.getCustomerInfo()
        const pro = info?.entitlements?.active?.[PRO_ENTITLEMENT_ID]
        if (cancelled) return
        setEnt({
          status: pro ? 'active' : 'inactive',
          store: (pro?.store as EntitlementStore) ?? 'unknown',
          managementURL: info?.managementURL ?? null,
        })
      } catch {
        // Fail closed for gating; the UI may retry.
        if (!cancelled) setEnt({ status: 'inactive', store: 'unknown', managementURL: null })
      }
    })()
    return () => { cancelled = true }
  }, [uid])
  return ent
}
