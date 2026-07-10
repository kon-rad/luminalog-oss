// In-memory vector index — brute-force cosine top-K over the user's decrypted
// vectors. Mirrors iOS `VectorIndex.swift`: a few thousand 512-dim vectors is
// sub-10ms, so no ANN. Vectors are assumed L2-normalized (the embedder
// normalizes), so cosine === dot product. Tie-break ascending entryId for a
// stable, cross-platform-identical ordering.

export interface ScoredEntry {
  entryId: string
  score: number
}

export class VectorIndex {
  private readonly vectors = new Map<string, Float32Array>()

  upsert(entryId: string, vector: Float32Array): void {
    this.vectors.set(entryId, vector)
  }

  remove(entryId: string): void {
    this.vectors.delete(entryId)
  }

  has(entryId: string): boolean {
    return this.vectors.has(entryId)
  }

  get size(): number {
    return this.vectors.size
  }

  topK(k: number, query: Float32Array): ScoredEntry[] {
    if (k <= 0) return []
    const scored: ScoredEntry[] = []
    this.vectors.forEach((vector, entryId) => {
      scored.push({ entryId, score: dot(query, vector) })
    })
    scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.entryId < b.entryId ? -1 : 1))
    return scored.slice(0, k)
  }
}

function dot(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length)
  let sum = 0
  for (let i = 0; i < n; i++) sum += a[i] * b[i]
  return sum
}
