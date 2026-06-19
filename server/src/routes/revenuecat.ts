import { Router, Request, Response } from 'express'
import admin from 'firebase-admin'
import { db } from '../middleware/firebaseAuth'
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

/**
 * RevenueCat webhook. Auth = shared secret in the `Authorization` header
 * (configured in the RevenueCat dashboard). Consumable credit purchases arrive
 * as NON_RENEWING_PURCHASE; we credit `users/{uid}.voiceCredits` exactly once,
 * deduping on the RevenueCat event id inside a Firestore transaction.
 *
 * `database` is injected for testability; the route binds the live `db`.
 */
export async function revenueCatWebhookHandler(
  req: Request,
  res: Response,
  database: FirebaseFirestore.Firestore = db,
): Promise<void> {
  const provided = req.headers.authorization
  if (provided !== config.REVENUECAT_WEBHOOK_SECRET) {
    res.status(401).json({ error: 'Invalid signature' })
    return
  }

  const event = (req.body?.event ?? {}) as Record<string, any>
  if (event.type !== 'NON_RENEWING_PURCHASE') { res.json({ ok: true }); return }

  const credits = creditsForProduct(event.product_id)
  const uid = event.app_user_id as string | undefined
  const eventId = event.id as string | undefined
  if (credits === null || !uid || !eventId) { res.json({ ok: true }); return }

  const userRef = database.collection('users').doc(uid)
  const eventRef = database.collection('revenuecatEvents').doc(eventId)

  await database.runTransaction(async (tx) => {
    const seen = await tx.get(eventRef)
    if (seen.exists) return // already processed — credit nothing
    tx.set(
      userRef,
      { voiceCredits: admin.firestore.FieldValue.increment(credits) },
      { merge: true },
    )
    tx.set(eventRef, {
      uid,
      productId: event.product_id,
      credits,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  })

  console.log('[revenuecat/webhook]', JSON.stringify({ uid, productId: event.product_id, credits, eventId }))
  res.json({ ok: true })
}

revenueCatRouter.post('/webhook', (req: Request, res: Response) => revenueCatWebhookHandler(req, res))
