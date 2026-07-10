// Orchestrates on-device indexing + retrieval, mirroring iOS
// `SemanticIndexCoordinator`. Dependencies are injected (embedder, vector
// service, index, DEK getter) so this is testable with fakes — no model load or
// network. One vector per entry (no chunking). `model` is stored beside each
// blob so a future model swap can re-embed stale-model vectors.

import type { VectorIndex, ScoredEntry } from '@/lib/vectors/vectorIndex'
import type { VectorItem } from '@/lib/vectors/vectorService'
import { wrapVector, unwrapVector } from '@/lib/vectors/vectorEnvelope'

export interface VectorServicePort {
  list: () => Promise<VectorItem[]>
  upsert: (items: VectorItem[]) => Promise<void>
  delete: (entryId: string) => Promise<void>
}

export interface CoordinatorDeps {
  embed: (text: string) => Promise<Float32Array>
  service: VectorServicePort
  index: VectorIndex
  getDEK: () => CryptoKey | null
  model: string
}

export interface BackfillEntry {
  id: string
  text: string
}

export class KeyUnavailableError extends Error {
  constructor() {
    super('Cannot index/decrypt vectors: the encryption key (DEK) is unavailable.')
    this.name = 'KeyUnavailableError'
  }
}

export class SemanticIndexCoordinator {
  constructor(private readonly deps: CoordinatorDeps) {}

  private requireDEK(): CryptoKey {
    const dek = this.deps.getDEK()
    if (!dek) throw new KeyUnavailableError()
    return dek
  }

  /** Embed one entry, seal the vector under the DEK, sync the blob, and index it. */
  async indexEntry(entryId: string, text: string): Promise<void> {
    const dek = this.requireDEK()
    const vector = await this.deps.embed(text)
    const blob = await wrapVector(dek, vector)
    await this.deps.service.upsert([{ entryId, blob, dim: vector.length, model: this.deps.model }])
    this.deps.index.upsert(entryId, vector)
  }

  /** Remove an entry's vector from both the server store and the in-memory index. */
  async removeEntry(entryId: string): Promise<void> {
    await this.deps.service.delete(entryId)
    this.deps.index.remove(entryId)
  }

  /** Load all stored blobs into the in-memory index (decrypt per item, fail-closed). */
  async loadIndex(): Promise<void> {
    const dek = this.requireDEK()
    const items = await this.deps.service.list()
    for (const item of items) {
      try {
        const vector = await unwrapVector(dek, item.blob)
        this.deps.index.upsert(item.entryId, vector)
      } catch {
        // Skip a corrupt/foreign row — never fatal (matches iOS loadIndex).
      }
    }
  }

  /** Embed + upsert only the entries not already in the index, in a single batch. */
  async backfill(entries: BackfillEntry[]): Promise<void> {
    const dek = this.requireDEK()
    const missing = entries.filter((e) => !this.deps.index.has(e.id))
    if (missing.length === 0) return
    const items: VectorItem[] = []
    const embedded: { id: string; vector: Float32Array }[] = []
    for (const entry of missing) {
      const vector = await this.deps.embed(entry.text)
      items.push({ entryId: entry.id, blob: await wrapVector(dek, vector), dim: vector.length, model: this.deps.model })
      embedded.push({ id: entry.id, vector })
    }
    await this.deps.service.upsert(items)
    for (const { id, vector } of embedded) this.deps.index.upsert(id, vector)
  }

  /** Semantic top-K over the local index. Empty index → [] (no query embed). */
  async search(query: string, k = 5): Promise<ScoredEntry[]> {
    if (this.deps.index.size === 0) return []
    const vector = await this.deps.embed(query)
    return this.deps.index.topK(k, vector)
  }
}
