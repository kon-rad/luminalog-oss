'use client'
import { getPurchases } from './revenuecat'

// Verified against the installed @revenuecat/purchases-js types
// (dist/Purchases.es.d.ts): `CustomerInfo.managementURL: string | null` is a
// real, typed field — "a link to the management page" for an active Web
// Billing subscription (points to the App Store / Play Store instead for
// mobile-store subscriptions, and is null with no active subscription). No
// `as any` cast needed and no dedicated SDK method exists for this.
/** Opens RevenueCat's hosted customer portal (cancel / update card / change plan). */
export async function openCustomerPortal(uid: string): Promise<void> {
  const purchases = await getPurchases(uid)
  const info = await purchases.getCustomerInfo()
  const url = info?.managementURL
  if (url) window.location.href = url
}
