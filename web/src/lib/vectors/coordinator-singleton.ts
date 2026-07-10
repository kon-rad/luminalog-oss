// The app-wide SemanticIndexCoordinator singleton + fire-and-forget helpers that
// the journal write-path and session bootstrap call. Wires the real embedder,
// the /api/vectors service, and the in-memory DEK. Indexing must NEVER block or
// crash a save, so indexEntrySafe/removeEntrySafe swallow (and log) every error.

import { embed, EMBEDDING_MODEL_ID } from '@/lib/embeddings/onnxEmbedder'
import { getCachedDEK } from '@/lib/crypto/dek'
import { VectorIndex } from '@/lib/vectors/vectorIndex'
import { listVectors, upsertVectors, deleteVector } from '@/lib/vectors/vectorService'
import { SemanticIndexCoordinator, type BackfillEntry } from '@/lib/vectors/semanticIndexCoordinator'

let coordinator: SemanticIndexCoordinator | null = null

export function getCoordinator(): SemanticIndexCoordinator {
  if (!coordinator) {
    coordinator = new SemanticIndexCoordinator({
      embed,
      service: { list: listVectors, upsert: upsertVectors, delete: deleteVector },
      index: new VectorIndex(),
      getDEK: getCachedDEK,
      model: EMBEDDING_MODEL_ID,
    })
  }
  return coordinator
}

/** Fire-and-forget index of one entry — never throws (logs and moves on). */
export async function indexEntrySafe(entryId: string, text: string): Promise<void> {
  try {
    await getCoordinator().indexEntry(entryId, text)
  } catch (err) {
    console.error('[semantic-index] indexEntry failed (non-fatal):', err)
  }
}

/** Fire-and-forget removal of one entry's vector — never throws. */
export async function removeEntrySafe(entryId: string): Promise<void> {
  try {
    await getCoordinator().removeEntry(entryId)
  } catch (err) {
    console.error('[semantic-index] removeEntry failed (non-fatal):', err)
  }
}

/** Session prime: load the stored index, then backfill any un-indexed entries. */
export async function primeSemanticIndex(entries: BackfillEntry[]): Promise<void> {
  try {
    const coord = getCoordinator()
    await coord.loadIndex()
    await coord.backfill(entries)
  } catch (err) {
    console.error('[semantic-index] prime failed (non-fatal):', err)
  }
}

/** Test-only: drop the singleton so a fresh index is built. */
export function __resetCoordinatorForTests(): void {
  coordinator = null
}
