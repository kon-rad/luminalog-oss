import { Router, Request, Response } from 'express'
import { firebaseAuth } from '../middleware/firebaseAuth'
import { config } from '../config'
import { verifyInfoRequest, liveEnsResolver, type EnsResolver } from '../services/infoRequests/protocol'
import { deliverWebhook, type WebhookResult } from '../services/infoRequests/webhookDelivery'
import { SlidingWindowLimiter } from '../services/infoRequests/rateLimiter'
import {
  firestoreDirectory, firestoreInboxStore, REQUEST_TTL_MS,
  type InboxStore, type RecipientDirectory, type StoredInfoRequest,
} from '../services/infoRequests/store'
import { buildResponseBody, normalizeAnswers, signResponseBody, signerAddress } from '../services/infoRequests/response'
import { isoSeconds } from '../services/infoRequests/time'

/**
 * Agent information requests (spec docs/superpowers/specs/2026-09-27-agent-info-requests-design.md).
 * POST /requests and GET /signer are PUBLIC; everything else is uid-scoped. The
 * server holds the sender's questions (their text, not the user's) until the user
 * answers or ignores; the user's answers pass through /respond transiently and are
 * never persisted or logged.
 */

export interface InboxDeps {
  store: InboxStore
  directory: RecipientDirectory
  now: () => number
  resolveEns: EnsResolver
  deliver: (url: string, body: string, headers: Record<string, string>) => Promise<WebhookResult>
  signerKey: () => string | undefined
  ipLimiter: SlidingWindowLimiter
  pairLimiter: SlidingWindowLimiter
  pendingCap: number
}

const clientView = (id: string, d: StoredInfoRequest) => ({
  id,
  sender: d.sender,
  reason: d.reason,
  questions: d.questions,
  webhookHost: d.webhookHost,
  createdAt: isoSeconds(d.createdAt),
  expiresAt: isoSeconds(d.expiresAt),
})

export function createInboxHandlers(deps: InboxDeps) {
  /** Owned, unexpired request or null (non-owner and expired both look like 404). */
  async function owned(uid: string, id: string): Promise<StoredInfoRequest | null> {
    const doc = await deps.store.get(id)
    if (!doc || doc.recipientUid !== uid) return null
    if (doc.expiresAt.getTime() <= deps.now()) { await deps.store.delete(id); return null }
    return doc
  }

  return {
    async createRequest(req: Request, res: Response): Promise<void> {
      try {
        if (!deps.ipLimiter.take(req.ip ?? 'unknown')) { res.status(429).json({ error: 'rate_limited' }); return }
        const v = await verifyInfoRequest(req.body, { now: deps.now, resolveEns: deps.resolveEns })
        if (!v.ok) { res.status(v.status).json({ error: v.error }); return }

        const uid = await deps.directory.resolve(v.body.to)
        if (!uid) { res.status(404).json({ error: 'recipient_not_found' }); return }
        if (!deps.pairLimiter.take(`${v.signer}:${uid}`)) { res.status(429).json({ error: 'rate_limited' }); return }
        if ((await deps.store.countPending(uid)) >= deps.pendingCap) { res.status(429).json({ error: 'inbox_full' }); return }

        const createdAt = new Date(deps.now())
        const expiresAt = new Date(createdAt.getTime() + REQUEST_TTL_MS)
        const created = await deps.store.create(v.hash, {
          recipientUid: uid,
          sender: { address: v.signer, ens: v.ens, name: v.body.from.name, description: v.body.from.description },
          reason: v.body.reason,
          questions: v.body.questions,
          webhookUrl: v.body.webhookUrl,
          webhookHost: new URL(v.body.webhookUrl).hostname,
          status: 'pending',
          createdAt,
          expiresAt,
          lastDeliveryError: null,
        })
        if (created === 'exists') { res.status(409).json({ error: 'duplicate' }); return }
        res.status(201).json({ id: v.hash, status: 'pending', expiresAt: isoSeconds(expiresAt) })
      } catch (err) {
        console.error('[inbox/requests]', err)
        res.status(500).json({ error: 'intake_failed' })
      }
    },

    async list(req: Request, res: Response): Promise<void> {
      try {
        const uid = (req as any).uid as string
        const now = deps.now()
        const all = await deps.store.listForRecipient(uid)
        const expired = all.filter(r => r.doc.expiresAt.getTime() <= now)
        await Promise.all(expired.map(r => deps.store.delete(r.id)))
        const requests = all
          .filter(r => r.doc.expiresAt.getTime() > now)
          .sort((a, b) => b.doc.createdAt.getTime() - a.doc.createdAt.getTime())
          .map(r => clientView(r.id, r.doc))
        res.json({ requests })
      } catch (err) {
        console.error('[inbox/list]', err)
        res.status(500).json({ error: 'list_failed' })
      }
    },

    async ignore(req: Request, res: Response): Promise<void> {
      try {
        const uid = (req as any).uid as string
        const id = String(req.params.id)
        if (!(await owned(uid, id))) { res.status(404).json({ error: 'not_found' }); return }
        await deps.store.delete(id)
        res.status(204).end()
      } catch (err) {
        console.error('[inbox/ignore]', err)
        res.status(500).json({ error: 'ignore_failed' })
      }
    },

    async respond(req: Request, res: Response): Promise<void> {
      try {
        const uid = (req as any).uid as string
        const id = String(req.params.id)
        const key = deps.signerKey()
        if (!signerAddress(key)) { res.status(503).json({ error: 'signer_unconfigured' }); return }
        const doc = await owned(uid, id)
        if (!doc) { res.status(404).json({ error: 'not_found' }); return }
        const answers = normalizeAnswers(doc.questions, (req.body as { answers?: unknown })?.answers)
        if (!answers) { res.status(400).json({ error: 'invalid_answers' }); return }

        const respondedAt = new Date(deps.now())
        const who = await deps.directory.respondent(uid)
        const body = buildResponseBody({ requestId: id, ...who, questions: doc.questions, answers, respondedAt })
        const { signer, signature } = await signResponseBody(body, key!)
        const result = await deps.deliver(doc.webhookUrl, body, { 'X-Argo-Signer': signer, 'X-Argo-Signature': signature })

        // Log only metadata: never the body (it holds the user's answers).
        console.log('[inbox/respond]', { id, host: doc.webhookHost, ok: result.ok, status: result.status, attempts: result.attempts })
        if (!result.ok) {
          const detail = result.error ?? `HTTP ${result.status}`
          await deps.store.setDeliveryError(id, detail)
          res.status(502).json({ error: 'delivery_failed', detail })
          return
        }
        await deps.store.delete(id)
        res.json({ delivered: true, deliveredAt: isoSeconds(respondedAt) })
      } catch (err) {
        console.error('[inbox/respond]', err instanceof Error ? err.message : 'error')
        res.status(500).json({ error: 'respond_failed' })
      }
    },

    async signer(_req: Request, res: Response): Promise<void> {
      const address = signerAddress(deps.signerKey())
      if (!address) { res.status(503).json({ error: 'signer_unconfigured' }); return }
      res.json({ address })
    },
  }
}

const handlers = createInboxHandlers({
  store: firestoreInboxStore,
  directory: firestoreDirectory,
  now: Date.now,
  resolveEns: liveEnsResolver,
  deliver: (url, body, headers) => deliverWebhook(url, body, headers),
  signerKey: () => config.INFO_RESPONSE_SIGNER_PRIVATE_KEY,
  ipLimiter: new SlidingWindowLimiter(30, 60 * 60 * 1000),
  pairLimiter: new SlidingWindowLimiter(3, 24 * 60 * 60 * 1000),
  pendingCap: 50,
})

export const inboxRouter = Router()
inboxRouter.post('/requests', handlers.createRequest) // PUBLIC: wallet-signed agent intake
inboxRouter.get('/signer', handlers.signer)            // PUBLIC: attestation address for receivers
inboxRouter.get('/', firebaseAuth, handlers.list)
inboxRouter.post('/:id/ignore', firebaseAuth, handlers.ignore)
inboxRouter.post('/:id/respond', firebaseAuth, handlers.respond)