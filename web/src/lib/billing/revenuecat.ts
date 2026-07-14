import { Purchases } from '@revenuecat/purchases-js'

export const BILLING_ENABLED = process.env.NEXT_PUBLIC_BILLING_ENABLED === 'true'
export const PRO_ENTITLEMENT_ID = 'pro'

// `Purchases.configure(...)` is synchronous (returns `Purchases`, not a
// Promise) in the installed SDK (v1.47.3) — the brief's draft assumed it
// might be async. `getPurchases` stays `async` regardless since awaiting a
// non-Promise value is a no-op, which keeps the exported signature the
// other tasks depend on (`Promise<Purchases>`) unchanged.
let configured: Purchases | null = null
let configuredAppUserId: string | null = null

/**
 * Configure the Web SDK once and log in as the Firebase uid (RevenueCat App
 * User ID). If a different uid is passed on a later call (e.g. a different
 * user signs in on the same tab), switches the already-configured instance
 * to that uid via `changeUser` rather than re-`configure`-ing (calling
 * `configure` twice just warns and replaces the singleton, which would also
 * work, but `changeUser` is the SDK's documented way to switch identity on
 * an existing instance).
 */
export async function getPurchases(appUserId: string): Promise<Purchases> {
  const key = process.env.NEXT_PUBLIC_RC_WEB_BILLING_KEY
  if (!key) throw new Error('NEXT_PUBLIC_RC_WEB_BILLING_KEY is not set')
  if (!configured) {
    configured = Purchases.configure({ apiKey: key, appUserId })
    configuredAppUserId = appUserId
  } else if (configuredAppUserId !== appUserId) {
    await configured.changeUser(appUserId)
    configuredAppUserId = appUserId
  }
  return configured
}
