import { ChromaClient, Collection } from 'chromadb'
import { config } from '../config'

const client = new ChromaClient({ path: config.CHROMA_URL })
let journalsCollection: Collection | null = null

export async function getJournalsCollection(): Promise<Collection> {
  if (!journalsCollection) {
    journalsCollection = await client.getOrCreateCollection({
      name: 'journals',
      metadata: { 'hnsw:space': 'cosine' },
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
    })
  }
  return summariesCollection
}

export function resetSummariesCollection(): void {
  summariesCollection = null
}
