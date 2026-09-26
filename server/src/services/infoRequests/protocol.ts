import { createHash } from 'crypto'
import { z } from 'zod'
import { createPublicClient, http, recoverMessageAddress } from 'viem'
import { mainnet } from 'viem/chains'
import { normalize } from 'viem/ens'
import { config } from '../../config'
import { isAcceptableWebhookUrl } from './webhookDelivery'

/**
 * Wire protocol for inbound agent information requests (spec section 4). The sender
 * signs a hash of a positional JSON array, so no key-order canonicalisation is
 * needed in any language. Strings are hashed exactly as sent: never trim here.
 */

export const REQUEST_PREFIX = 'Argo information request v1\n'
export const RESPONSE_PREFIX = 'Argo information response v1\n'
export const MAX_SKEW_MS = 10 * 60 * 1000

const nonBlank = (min: number, max: number) =>
  z.string().min(min).max(max).refine(s => s.trim().length > 0, 'blank')

export const infoRequestSchema = z.object({
  to: nonBlank(1, 64),
  from: z.object({
    address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    ens: nonBlank(3, 255).optional(),
    name: nonBlank(1, 80),
    description: nonBlank(1, 500),
  }),
  reason: nonBlank(1, 1000),
  questions: z.array(nonBlank(1, 500)).min(1).max(10),
  webhookUrl: z.string().min(1).max(2048),
  issuedAt: z.string().datetime({ offset: true }),
  nonce: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
})

export type InfoRequestBody = z.infer<typeof infoRequestSchema>

export function canonicalPayload(b: InfoRequestBody): string {
  return JSON.stringify([
    b.to, b.from.address.toLowerCase(), b.from.ens ?? '', b.from.name, b.from.description,
    b.reason, b.questions, b.webhookUrl, b.issuedAt, b.nonce,
  ])
}

export const sha256Hex = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')
export const requestHash = (b: InfoRequestBody) => sha256Hex(canonicalPayload(b))

/** Returns the lowercase ENS-resolved address, null when unresolved; throws when the RPC is unavailable. */
export type EnsResolver = (name: string) => Promise<string | null>

export type VerifyResult =
  | { ok: true; body: InfoRequestBody; hash: string; signer: string; ens: string | null }
  | { ok: false; status: number; error: string }

export async function verifyInfoRequest(
  raw: unknown,
  deps: { now: () => number; resolveEns: EnsResolver },
): Promise<VerifyResult> {
  const parsed = infoRequestSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, status: 400, error: 'invalid_body' }
  const body = parsed.data

  if (!isAcceptableWebhookUrl(body.webhookUrl)) return { ok: false, status: 400, error: 'invalid_webhook' }

  const issued = Date.parse(body.issuedAt)
  if (!Number.isFinite(issued) || Math.abs(deps.now() - issued) > MAX_SKEW_MS) {
    return { ok: false, status: 400, error: 'stale_request' }
  }

  const hash = requestHash(body)
  let signer: string
  try {
    signer = (await recoverMessageAddress({
      message: REQUEST_PREFIX + hash,
      signature: body.signature as `0x${string}`,
    })).toLowerCase()
  } catch {
    return { ok: false, status: 401, error: 'bad_signature' }
  }
  if (signer !== body.from.address.toLowerCase()) return { ok: false, status: 401, error: 'bad_signature' }

  let ens: string | null = null
  if (body.from.ens) {
    let resolved: string | null
    try {
      resolved = await deps.resolveEns(body.from.ens)
    } catch {
      return { ok: false, status: 503, error: 'ens_unavailable' }
    }
    if (!resolved || resolved.toLowerCase() !== signer) return { ok: false, status: 422, error: 'ens_mismatch' }
    ens = body.from.ens
  }

  return { ok: true, body, hash, signer, ens }
}

let mainnetClient: ReturnType<typeof createPublicClient> | null = null

export const liveEnsResolver: EnsResolver = async name => {
  let normalized: string
  try { normalized = normalize(name) } catch { return null } // invalid name -> mismatch, not outage
  mainnetClient ??= createPublicClient({ chain: mainnet, transport: http(config.ETH_MAINNET_RPC_URL) })
  const address = await mainnetClient.getEnsAddress({ name: normalized })
  return address ? address.toLowerCase() : null
}
