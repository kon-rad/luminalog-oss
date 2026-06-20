import { getSummariesCollection, resetSummariesCollection } from '../db/chroma'
import { decryptField } from '../crypto/fieldCipher'

export interface GraphNode {
  id: string      // entryId
  title: string
  date: string
  type: string
  degree: number
}

export interface GraphLink {
  source: string
  target: string
  value: number   // cosine similarity
}

export interface JournalGraph {
  nodes: GraphNode[]
  links: GraphLink[]
}

/** L2-normalize a vector so dot product equals cosine similarity. */
function normalize(v: number[]): number[] {
  let sum = 0
  for (const x of v) sum += x * x
  const norm = Math.sqrt(sum) || 1
  return v.map(x => x / norm)
}

function dot(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

/**
 * Build an undirected similarity graph over all of a user's summary vectors.
 * Edges = union of each node's top-K neighbors above `minSimilarity`, deduped
 * undirected, then greedily capped at `maxDegree` per node (strongest first).
 */
export async function buildGraph(params: {
  userId: string
  dek: Buffer
  topK: number
  minSimilarity: number
  maxDegree: number
}): Promise<JournalGraph> {
  const { userId, dek, topK, minSimilarity, maxDegree } = params
  if (!userId) throw new Error('userId required')

  const col = await getSummariesCollection()
  let all: any
  try {
    all = await col.get({
      where: { userId: { $eq: userId } },
      include: ['embeddings', 'metadatas'] as any,
    })
  } catch (err) {
    resetSummariesCollection()
    throw err
  }

  const rawIds: string[] = all.ids ?? []
  const embeddings: number[][] = (all.embeddings ?? []) as number[][]
  const metas: Record<string, unknown>[] = (all.metadatas ?? []) as Record<string, unknown>[]
  if (rawIds.length === 0) return { nodes: [], links: [] }

  // Node identity is the journal entryId (from metadata), not the Chroma vectorId.
  const entryIds: string[] = metas.map((m, i) => (m?.entryId as string) ?? rawIds[i])
  const normed = embeddings.map(normalize)

  const nodes: GraphNode[] = entryIds.map((id, i) => {
    const m = metas[i] ?? {}
    const title = m.title ? decryptField(dek, JSON.parse(m.title as string), 'journals.title') : ''
    return { id, title, date: (m.date as string) ?? '', type: (m.type as string) ?? 'text', degree: 0 }
  })

  // Candidate edges: each node's top-K neighbors above the floor.
  // Collect into an undirected map keyed by the sorted id pair, keeping max score.
  const edgeMap = new Map<string, GraphLink>()
  const n = entryIds.length
  for (let i = 0; i < n; i++) {
    const sims: { j: number; score: number }[] = []
    for (let j = 0; j < n; j++) {
      if (j === i) continue
      const score = dot(normed[i], normed[j])
      if (score >= minSimilarity) sims.push({ j, score })
    }
    sims.sort((a, b) => b.score - a.score)
    for (const { j, score } of sims.slice(0, topK)) {
      const a = entryIds[i]
      const b = entryIds[j]
      const key = a < b ? `${a}|${b}` : `${b}|${a}`
      const existing = edgeMap.get(key)
      if (!existing || score > existing.value) {
        edgeMap.set(key, { source: a < b ? a : b, target: a < b ? b : a, value: score })
      }
    }
  }

  // Greedy degree cap: add strongest edges first, skip an edge if either
  // endpoint is already at maxDegree.
  const sortedEdges = Array.from(edgeMap.values()).sort((x, y) => y.value - x.value)
  const degree = new Map<string, number>(entryIds.map(id => [id, 0]))
  const links: GraphLink[] = []
  for (const e of sortedEdges) {
    if ((degree.get(e.source) ?? 0) >= maxDegree) continue
    if ((degree.get(e.target) ?? 0) >= maxDegree) continue
    links.push(e)
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1)
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1)
  }

  for (const node of nodes) node.degree = degree.get(node.id) ?? 0

  return { nodes, links }
}

// --- In-memory per-user cache (single PM2 process; rebuilt on cold start) ---
// Matches the "rebuild on next open" policy: invalidated on entry save/delete,
// lazily rebuilt on the next /graph call. No Firestore doc-size limits.
const cache = new Map<string, JournalGraph>()

export async function getGraph(params: {
  userId: string
  dek: Buffer
  topK: number
  minSimilarity: number
  maxDegree: number
}): Promise<JournalGraph> {
  const cached = cache.get(params.userId)
  if (cached) return cached
  const graph = await buildGraph(params)
  cache.set(params.userId, graph)
  return graph
}

export function invalidateGraph(userId: string): void {
  cache.delete(userId)
}
