import { Router, Request, Response } from 'express'
import admin from 'firebase-admin'
import { db, firebaseAuth } from '../middleware/firebaseAuth'
import { config } from '../config'

export const revenueCatRouter = Router()

// Canonical product → credits map. Source of truth: docs/PRICING.md §7.
// Mirrors iOS CreditPack.creditsPerProduct; keep both in sync.
const CREDITS_PER_PRODUCT: Record<string, number> = {
  'com.luminalog.credits.5': 5,
  'com.luminalog.credits.10': 10,
  'com.luminalog.credits.20': 20,
  'com.luminalog.credits.50': 50,
}

/** Credits awarded for a product id, or null if it is not a credit pack. */
export function creditsForProduct(productId: string | undefined): number | null {
  if (!productId) return null
  return CREDITS_PER_PRODUCT[productId] ?? null
}

export const PRO_ENTITLEMENT_ID = 'pro'

// RevenueCat subscription lifecycle event types that carry the current expiry.
const SUBSCRIPTION_EVENT_TYPES = new Set([
  'INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION',
  'CANCELLATION', 'EXPIRATION', 'SUBSCRIPTION_EXTENDED',
])

// RevenueCat `store` -> our `entitlement.source` label.
function sourceFromStore(store: unknown): string {
  switch (store) {
    case 'APP_STORE':
    case 'MAC_APP_STORE': return 'app_store'
    case 'PLAY_STORE': return 'play_store'
    case 'STRIPE': return 'stripe'
    case 'RC_BILLING': return 'rc_billing'
    case 'PROMOTIONAL': return 'promotional'
    default: return typeof store === 'string' ? store.toLowerCase() : 'unknown'
  }
}

/**
 * For a `pro` subscription lifecycle event, return the entitlement's current
 * expiry (ms since epoch) and its source store. Returns null for anything that
 * is not a pro subscription with an expiry. Read-time compares proExpiresAtMs
 * to now to decide isPro, so EXPIRATION (past expiry) is surfaced, not special-cased.
 */
export function proExpiryFromEvent(
  event: Record<string, any>,
): { proExpiresAtMs: number; source: string } | null {
  if (!SUBSCRIPTION_EVENT_TYPES.has(event?.type)) return null
  const ids: unknown = event?.entitlement_ids
  if (!Array.isArray(ids) || !ids.includes(PRO_ENTITLEMENT_ID)) return null
  const expiry = event?.expiration_at_ms
  if (typeof expiry !== 'number') return null
  return { proExpiresAtMs: expiry, source: sourceFromStore(event?.store) }
}

/**
 * RevenueCat webhook. Auth = shared secret passed as the `?secret=` URL query
 * param (configured in the RevenueCat dashboard webhook URL — sent verbatim,
 * same trick as the Vapi webhook), falling back to the `Authorization` header
 * for backward compatibility. Consumable credit purchases arrive as
 * NON_RENEWING_PURCHASE; we credit `users/{uid}.voiceCredits` exactly once,
 * deduping on the RevenueCat event id inside a Firestore transaction.
 *
 * `database` is injected for testability; the route binds the live `db`.
 */
export async function revenueCatWebhookHandler(
  req: Request,
  res: Response,
  database: FirebaseFirestore.Firestore = db,
): Promise<void> {
  const provided = (req.query?.['secret'] ?? req.headers.authorization) as string | undefined
  if (provided !== config.REVENUECAT_WEBHOOK_SECRET) {
    res.status(401).json({ error: 'Invalid signature' })
    return
  }

  const event = (req.body?.event ?? {}) as Record<string, any>
  const uidAny = event.app_user_id as string | undefined
  const eventIdAny = event.id as string | undefined

  // --- Subscription entitlement branch (iOS IAP + web, unified by RevenueCat) ---
  const proUpdate = proExpiryFromEvent(event)
  if (proUpdate && uidAny && eventIdAny) {
    const userRef = database.collection('users').doc(uidAny)
    const eventRef = database.collection('revenuecatEvents').doc(eventIdAny)
    await database.runTransaction(async (tx) => {
      const seen = await tx.get(eventRef)
      if (seen.exists) return
      tx.set(userRef, {
        entitlement: {
          proExpiresAtMs: proUpdate.proExpiresAtMs,
          source: proUpdate.source,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      }, { merge: true })
      tx.set(eventRef, {
        uid: uidAny, type: event.type, entitlement: PRO_ENTITLEMENT_ID,
        proExpiresAtMs: proUpdate.proExpiresAtMs,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    })
    console.log('[revenuecat/webhook] entitlement', JSON.stringify({ uid: uidAny, type: event.type, proExpiresAtMs: proUpdate.proExpiresAtMs, eventId: eventIdAny }))
    res.json({ ok: true })
    return
  }

  if (event.type !== 'NON_RENEWING_PURCHASE') { res.json({ ok: true }); return }

  const credits = creditsForProduct(event.product_id)
  if (credits === null || !uidAny || !eventIdAny) { res.json({ ok: true }); return }

  const userRef = database.collection('users').doc(uidAny)
  const eventRef = database.collection('revenuecatEvents').doc(eventIdAny)

  await database.runTransaction(async (tx) => {
    const seen = await tx.get(eventRef)
    if (seen.exists) return // already processed — credit nothing
    tx.set(
      userRef,
      { voiceCredits: admin.firestore.FieldValue.increment(credits) },
      { merge: true },
    )
    tx.set(eventRef, {
      uid: uidAny,
      productId: event.product_id,
      credits,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  })

  console.log('[revenuecat/webhook]', JSON.stringify({ uid: uidAny, productId: event.product_id, credits, eventId: eventIdAny }))
  res.json({ ok: true })
}

revenueCatRouter.post('/webhook', (req: Request, res: Response) => revenueCatWebhookHandler(req, res))

/**
 * Pure derivation of the caller's `pro` entitlement from their Firestore user
 * doc. `isPro` is computed at read time (`proExpiresAtMs > nowMs`), never
 * stored — an expired subscription reads false even without a fresh webhook.
 */
export function computeEntitlement(
  doc: { entitlement?: { proExpiresAtMs?: number; source?: string } } | undefined,
  nowMs: number,
): { isPro: boolean; source: string | null; expiresAt: string | null } {
  const ent = doc?.entitlement
  const exp = ent?.proExpiresAtMs
  if (typeof exp !== 'number') return { isPro: false, source: null, expiresAt: null }
  return {
    isPro: exp > nowMs,
    source: ent?.source ?? null,
    expiresAt: new Date(exp).toISOString(),
  }
}

/** Authed: returns the caller's computed entitlement. `firebaseAuth` sets `(req as any).uid`. */
export async function entitlementHandler(
  req: Request,
  res: Response,
  database: FirebaseFirestore.Firestore = db,
): Promise<void> {
  const uid = (req as any).uid as string
  if (!uid) { res.status(401).json({ error: 'unauthenticated' }); return }
  const snap = await database.collection('users').doc(uid).get()
  res.json(computeEntitlement(snap.exists ? (snap.data() as any) : undefined, Date.now()))
}

export const entitlementRouter = Router()
entitlementRouter.get('/', firebaseAuth, (req, res) => entitlementHandler(req, res))
