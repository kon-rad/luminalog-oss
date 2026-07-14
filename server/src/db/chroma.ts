import { ChromaClient, Collection } from 'chromadb'
import { config } from '../config'

// chromadb JS client v3 connects via host/port/ssl (the v1-era `{ path }` form is
// gone) and speaks the Chroma v2 API. Parse CHROMA_URL (e.g. http://localhost:8000)
// into those parts so a single env var still configures the connection.
const chromaUrl = new URL(config.CHROMA_URL || 'http://localhost:8000')
const client = new ChromaClient({
  host: chromaUrl.hostname,
  port: chromaUrl.port
    ? Number(chromaUrl.port)
    : chromaUrl.protocol === 'https:'
      ? 443
      : 80,
  ssl: chromaUrl.protocol === 'https:',
})
let journalsCollection: Collection | null = null

export async function getJournalsCollection(): Promise<Collection> {
  if (!journalsCollection) {
    journalsCollection = await client.getOrCreateCollection({
      name: 'journals',
      metadata: { 'hnsw:space': 'cosine' },
      // We ALWAYS supply precomputed embeddings (Morpheus BGE-M3), so Chroma needs
      // no embedding function. Passing null opts out of v3's DefaultEmbeddingFunction
      // (which otherwise warns/requires @chroma-core/default-embed).
      embeddingFunction: null,
    })
  }
  return journalsCollection
}

// Called by the indexer when a Chroma operation fails, forcing a reconnect
// on the next getJournalsCollection() call (handles Chroma restarts).
export function resetJournalsCollection(): void {
  journalsCollection = null
}

let summariesCollection: Collection | null = null

export async function getSummariesCollection(): Promise<Collection> {
  if (!summariesCollection) {
    summariesCollection = await client.getOrCreateCollection({
      name: 'journal_summaries',
      metadata: { 'hnsw:space': 'cosine' },
      embeddingFunction: null,
    })
  }
  return summariesCollection
}

export function resetSummariesCollection(): void {
  summariesCollection = null
}
