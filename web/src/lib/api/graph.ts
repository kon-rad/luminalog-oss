import { apiPost } from '@/lib/api/client'
import { JournalType } from '@/lib/firestore/models'

// Typed browser client for the M8-T2 Constellation graph proxy route
// (design §2 M8-T2). Mirrors the shape of `lib/api/ai.ts`'s wrappers — all
// calls go through `apiPost`, which owns auth + 401-retry + throwing on
// non-2xx; this file just shapes the request/response.

export interface GraphNode {
  id: string
  title: string
  date: string
  type: JournalType
  degree: number
}

export interface GraphLink {
  source: string
  target: string
  value: number
}

export interface JournalGraph {
  nodes: GraphNode[]
  links: GraphLink[]
}

export function fetchGraph(): Promise<JournalGraph> {
  return apiPost('/api/rag/graph', {})
}
