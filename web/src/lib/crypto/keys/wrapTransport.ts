import { apiGet, apiPut } from '@/lib/api/client'
import { isWrappedKeyEnvelope, type WrappedKeyEnvelope } from '@/lib/crypto/wrappedKey'

// Network transport for the zero-knowledge wrapped-key store. Carries only
// OPAQUE `{v,iv,ct,tag}` ciphertext: the server holds none of the KEKs and can
// never unwrap what passes through here. Ownership is resolved server-side from
// the auth token, so no uid is ever sent.
//
// Mirrors iOS `Core/Crypto/KeyMigrationTransport.swift`.

/** The KEK slots the server accepts. Keep in sync with `WRAP_METHODS` in
 *  `server/src/routes/keys.ts`. `icloud` is unreachable from a browser and is
 *  modelled here only so a web client can see that it exists. */
export const WRAP_METHODS = ['icloud', 'recovery'] as const
export type WrapMethod = (typeof WRAP_METHODS)[number]

export type WrapMap = Partial<Record<WrapMethod, WrappedKeyEnvelope>>

export interface StoredWraps {
  wrappedKeys: WrapMap
  zkKeyVersion: number | null
}

function isWrapMethod(x: string): x is WrapMethod {
  return (WRAP_METHODS as readonly string[]).includes(x)
}

/**
 * Fetch the caller's wrap envelopes. Unknown methods and malformed values are
 * DROPPED rather than surfaced: a caller must never be handed something that
 * looks like an envelope but is not, because the failure would then appear at
 * unwrap time as an indistinguishable "wrong code".
 */
export async function fetchWraps(): Promise<StoredWraps> {
  const raw = await apiGet<{ wrappedKeys?: unknown; zkKeyVersion?: unknown }>('/api/keys/wrapped')

  const wrappedKeys: WrapMap = {}
  const source = raw?.wrappedKeys
  if (typeof source === 'object' && source !== null && !Array.isArray(source)) {
    for (const [method, value] of Object.entries(source as Record<string, unknown>)) {
      if (isWrapMethod(method) && isWrappedKeyEnvelope(value)) wrappedKeys[method] = value
    }
  }

  const version = raw?.zkKeyVersion
  return {
    wrappedKeys,
    zkKeyVersion: typeof version === 'number' && Number.isFinite(version) ? version : null,
  }
}

/**
 * Store wrap envelopes. The server merges, so uploading one slot never clobbers
 * the other. Throws on an empty map instead of issuing a request the server is
 * guaranteed to reject with a 400.
 */
export async function uploadWraps(wraps: WrapMap, keyVersion = 1): Promise<void> {
  if (Object.keys(wraps).length === 0) {
    throw new Error('uploadWraps: at least one envelope is required')
  }
  await apiPut('/api/keys/wrapped', { wraps, keyVersion })
}
