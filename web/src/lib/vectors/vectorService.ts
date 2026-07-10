// Client for the encrypted-vector blob store, via the same-origin `/api/vectors`
// proxy → backend `/v1/vectors`. The server is a dumb ciphertext store: it never
// parses or decrypts a `blob`, does no similarity math, and scopes everything to
// the caller's uid from the auth token. Mirrors iOS `ProxyVectorService`.

import { apiGet, apiPost, apiDelete } from '@/lib/api/client'

export interface VectorItem {
  entryId: string
  blob: string
  dim: number
  model: string
}

/** List all of the caller's stored vector blobs. */
export async function listVectors(): Promise<VectorItem[]> {
  const res = await apiGet<{ vectors?: VectorItem[] }>('/api/vectors')
  return res.vectors ?? []
}

/** Bulk upsert (create/replace) vector blobs — used for indexing + backfill. */
export async function upsertVectors(items: VectorItem[]): Promise<void> {
  await apiPost('/api/vectors', { vectors: items })
}

/** Delete one entry's vector blob. */
export async function deleteVector(entryId: string): Promise<void> {
  await apiDelete(`/api/vectors/${encodeURIComponent(entryId)}`)
}
