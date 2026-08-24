'use client'
import { getPurchases } from './revenuecat'

/**
 * Where a subscription is billed, and therefore who is allowed to cancel it.
 *
 * These strings are the RevenueCat Web SDK's `Store` union verbatim. They are
 * also what the server writes into `entitlement.source` (`sourceFromStore` in
 * `server/src/routes/revenuecat.ts`) and what iOS mirrors in
 * `EntitlementStore`, so all three surfaces speak one vocabulary.
 */
export type EntitlementStore =
  | 'app_store'
  | 'mac_app_store'
  | 'play_store'
  | 'amazon'
  | 'stripe'
  | 'rc_billing'
  | 'promotional'
  | 'paddle'
  | 'test_store'
  | 'galaxy'
  | 'unknown'

/** What the Manage control should do (design 2026-08-23, section 3). */
export type ManageDestination =
  /** Not subscribed: send them to the upgrade path. */
  | { kind: 'upgrade' }
  /**
   * Billed by Apple. A browser cannot cancel an App Store subscription, so the
   * only honest answer is to name the rail and point at iOS Settings. This is
   * the one place the UI says where a subscription was bought.
   */
  | { kind: 'appStore' }
  /** Ours: RevenueCat's hosted customer portal. */
  | { kind: 'portal'; url: string }
  /** Pro, but with no billing the user can act on (a promotional grant). */
  | { kind: 'notManageable' }

/**
 * Pure routing, mirroring `ProfileViewModel.manageDestination` on iOS.
 *
 * The `notManageable` fallback is why this is not just "open managementURL":
 * a granted plan has no URL, and sending that person to a store page would
 * show them a screen that never lists their subscription.
 */
export function manageDestination(
  status: 'loading' | 'active' | 'inactive',
  store: EntitlementStore,
  managementURL: string | null,
): ManageDestination {
  if (status !== 'active') return { kind: 'upgrade' }
  if (store === 'app_store' || store === 'mac_app_store') return { kind: 'appStore' }
  if (store === 'promotional') return { kind: 'notManageable' }
  if (managementURL) return { kind: 'portal', url: managementURL }
  return { kind: 'notManageable' }
}

// Verified against the installed @revenuecat/purchases-js types
// (dist/Purchases.es.d.ts): `CustomerInfo.managementURL: string | null` is a
// real, typed field, "a link to the management page" for an active Web
// Billing subscription (it points to the App Store / Play Store instead for
// mobile-store subscriptions, and is null with no active subscription). No
// `as any` cast needed and no dedicated SDK method exists for this.
/** Opens RevenueCat's hosted customer portal (cancel / update card / change plan). */
export async function openCustomerPortal(uid: string): Promise<void> {
  const purchases = await getPurchases(uid)
  const info = await purchases.getCustomerInfo()
  const url = info?.managementURL
  if (url) window.location.href = url
}
