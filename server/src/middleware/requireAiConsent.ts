import { Request, Response, NextFunction } from 'express'
import { db } from './firebaseAuth'
import { enforceAiConsentEnabled } from '../config'

// ---------------------------------------------------------------------------
// requireAiConsent — defense-in-depth guard (increment 1b).
//
// Returns 403 if the caller has not recorded `consent.aiDataSharing === true`.
//
// GATED by the OPTIONAL config flag ENFORCE_AI_CONSENT (default OFF). While the
// flag is OFF — the production default — this is a pure NO-OP pass-through, so
// existing users are NEVER blocked. It flips ON only AFTER the consent UI (1e)
// ships and users have had a chance to accept. Assumes an upstream auth
// middleware has already set `(req as any).uid`.
// ---------------------------------------------------------------------------
export async function requireAiConsent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Flag OFF (default): no-op — behavior is identical to not having this guard.
  if (!enforceAiConsentEnabled()) {
    next()
    return
  }

  const uid = (req as any).uid as string | undefined
  if (!uid) {
    res.status(401).json({ error: 'Missing authenticated user' })
    return
  }

  try {
    const snap = await db.collection('users').doc(uid).get()
    const consent = snap.exists
      ? (snap.get('consent') as { aiDataSharing?: unknown } | undefined)
      : undefined
    if (consent?.aiDataSharing !== true) {
      res.status(403).json({ error: 'AI data-sharing consent required' })
      return
    }
    next()
  } catch (e) {
    console.error('[requireAiConsent]', e)
    res.status(500).json({ error: 'Consent check failed' })
  }
}
