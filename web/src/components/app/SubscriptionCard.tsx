'use client'

import { useSession } from '@/lib/session/session-context'
import { useEntitlement } from '@/lib/billing/useEntitlement'
import { BILLING_ENABLED } from '@/lib/billing/revenuecat'
import { manageDestination } from '@/lib/billing/manage'
import SubscribeButton from '@/components/app/SubscribeButton'

// Settings > Subscription (design 2026-08-23, section 3).
//
// The mirror of the iOS Subscription row: the same routing, taken from the
// same `store` label, so a subscription bought on either rail is managed from
// either rail wherever that is actually possible. The one asymmetry is Apple:
// a browser cannot cancel an App Store subscription, so that branch explains
// rather than links.
//
// Hidden entirely while BILLING_ENABLED is false, which is the production
// default until the RevenueCat dashboard is configured. A settings card that
// reports "Free plan" to everyone would be worse than no card.
export default function SubscriptionCard() {
  const { uid } = useSession()
  const ent = useEntitlement(BILLING_ENABLED ? uid : null)

  if (!BILLING_ENABLED) return null

  const destination = manageDestination(ent.status, ent.store, ent.managementURL)
  const label =
    ent.status === 'loading' ? 'Checking...' : ent.status === 'active' ? 'Argo Pro' : 'Free plan'

  return (
    <section className="card flex flex-col gap-2 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text2)' }}>
        Subscription
      </h2>
      <p className="text-sm" style={{ color: 'var(--text)' }}>
        {label}
      </p>

      {destination.kind === 'upgrade' && ent.status === 'inactive' && (
        <div className="flex flex-col items-start gap-2 pt-1">
          <p className="text-sm" style={{ color: 'var(--text2)' }}>
            Your journal stays free. Pro adds the AI that reads it back to you.
          </p>
          <SubscribeButton plan="$rc_monthly" label="Upgrade to Pro" successPath="/settings" />
        </div>
      )}

      {destination.kind === 'portal' && (
        <a
          href={destination.url}
          className="self-start pt-1 text-sm font-semibold"
          style={{ color: 'var(--accent)' }}
        >
          Manage subscription
        </a>
      )}

      {destination.kind === 'appStore' && (
        <p className="text-sm" style={{ color: 'var(--text2)' }}>
          You subscribed through the App Store, so Apple handles the billing. Manage or cancel it
          on your iPhone: Settings, then your name, then Subscriptions.
        </p>
      )}

      {destination.kind === 'notManageable' && (
        <p className="text-sm" style={{ color: 'var(--text2)' }}>
          Your Pro access was granted directly, so there is no subscription to manage here.
        </p>
      )}
    </section>
  )
}
