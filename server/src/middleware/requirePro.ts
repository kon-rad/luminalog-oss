import { Request, Response, NextFunction } from 'express'
import admin from 'firebase-admin'
import { db } from './firebaseAuth'
import { config, enforceProEnabled } from '../config'
import { computeEntitlement, PRO_ENTITLEMENT_ID } from '../routes/revenuecat'

// ---------------------------------------------------------------------------
// requirePro: the paywall's enforcement point (design §1,
// docs/superpowers/specs/2026-08-23-cross-platform-subscription-design.md).
//
// Returns 402 for callers without an active `pro` entitlement. Applied to the
// AI/RAG *consumption* routes only; indexing and storage stay free so that an
// upgrade needs no backfill.
//
// GATED by the OPTIONAL config flag ENFORCE_PRO (default OFF), exactly like
// requireAiConsent. While the flag is OFF, the production default, this is a
// pure no-op pass-through. It flips ON only after the would-have-blocked rate is
// confirmed near zero for the shipped iOS clients, which hit these same routes.
// Assumes an upstream auth middleware has already set `(req as any).uid`.
//
// Truth model: Firestore is the fast cache (kept current by the RevenueCat
// webhook), RevenueCat itself is the backstop. When Firestore says not-Pro we
// ask RevenueCat directly before rejecting, so a dropped webhook self-corrects
// on the user's next AI action instead of becoming a support ticket. That same
// fallback is what closes the post-checkout race on web: the SDK completes the
// purchase in-page moments before the webhook lands.
// ---------------------------------------------------------------------------

/** Looks up a uid's live `pro` entitlement at RevenueCat. `null` = no active record. */
export type RevenueCatLookup = (
  uid: string,
) => Promise<{ proExpiresAtMs: number; source: string } | null>

// RevenueCat reports a non-expiring (lifetime/promotional) entitlement as a null
// `expires_date`. computeEntitlement compares a number, so those are stored as a
// far-future stamp. A later revocation still arrives by webhook and overwrites it.
const NON_EXPIRING_MS = Date.UTC(2099, 0, 1)

/**
 * Fetch the caller's `pro` entitlement straight from the RevenueCat REST API.
 *
 * Returns null when no REST key is configured, so a forgotten
 * `REVENUECAT_REST_API_KEY` degrades this guard to Firestore-only rather than
 * to an outage.
 */
export async function fetchRevenueCatEntitlement(
  uid: string,
): Promise<{ proExpiresAtMs: number; source: string } | null> {
  const key = config.REVENUECAT_REST_API_KEY
  if (!key) return null

  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`,
    { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' } },
  )
  if (!res.ok) {
    console.warn('[requirePro] revenuecat lookup failed', JSON.stringify({ uid, status: res.status }))
    return null
  }

  const subscriber = ((await res.json()) as any)?.subscriber
  const ent = subscriber?.entitlements?.[PRO_ENTITLEMENT_ID]
  if (!ent) return null

  const proExpiresAtMs =
    ent.expires_date == null ? NON_EXPIRING_MS : Date.parse(ent.expires_date)
  if (!Number.isFinite(proExpiresAtMs)) return null

  // The REST payload carries the store on the subscription, not the entitlement.
  // Its values (`app_store`, `play_store`, `stripe`, `rc_billing`, `promotional`)
  // are already the lowercase form the webhook's sourceFromStore() normalizes to.
  const productId = ent.product_identifier
  const store = productId ? subscriber?.subscriptions?.[productId]?.store : undefined
  return {
    proExpiresAtMs,
    source: typeof store === 'string' ? store.toLowerCase() : 'unknown',
  }
}

/**
 * `database` and `lookup` are injected for testability with defaults bound to
 * the live services, matching revenueCatWebhookHandler's convention. Express
 * only ever passes three arguments, so the defaults apply in production.
 */
export async function requirePro(
  req: Request,
  res: Response,
  next: NextFunction,
  database: FirebaseFirestore.Firestore = db,
  lookup: RevenueCatLookup = fetchRevenueCatEntitlement,
): Promise<void> {
  // Flag OFF (default): no-op, behavior is identical to not having this guard.
  if (!enforceProEnabled()) {
    next()
    return
  }

  const uid = (req as any).uid as string | undefined
  if (!uid) {
    res.status(401).json({ error: 'Missing authenticated user' })
    return
  }

  const userRef = database.collection('users').doc(uid)

  let stored: { isPro: boolean }
  try {
    const snap = await userRef.get()
    stored = computeEntitlement(snap.exists ? (snap.data() as any) : undefined, Date.now())
  } catch (e) {
    console.error('[requirePro] entitlement read failed', e)
    res.status(500).json({ error: 'Entitlement check failed' })
    return
  }

  if (stored.isPro) {
    next()
    return
  }

  // Firestore says no. Ask RevenueCat before rejecting, and write through so the
  // next request takes the fast path. Any failure here leaves us exactly where
  // we already were (not-Pro), so it must never turn into a 500.
  try {
    const live = await lookup(uid)
    if (live && computeEntitlement({ entitlement: live }, Date.now()).isPro) {
      await userRef.set(
        {
          entitlement: {
            proExpiresAtMs: live.proExpiresAtMs,
            source: live.source,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true },
      )
      console.log('[requirePro] self-healed entitlement', JSON.stringify({ uid, source: live.source }))
      next()
      return
    }
  } catch (e) {
    console.error('[requirePro] revenuecat self-heal failed', e)
  }

  res.status(402).json({ error: 'pro_required' })
}
