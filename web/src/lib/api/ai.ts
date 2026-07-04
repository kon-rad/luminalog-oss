import { apiPost } from '@/lib/api/client'
import { JournalType } from '@/lib/firestore/models'

// Typed browser client for the M3 AI/RAG same-origin proxy routes (design §2/§3
// M3-T1). All calls go through `apiPost`, which owns auth + 401-retry + throwing
// on non-2xx — these wrappers just shape the request/response.

export type SummaryResponse = {
  text: string
  model?: string
  generatedAt?: string
}

export type DailyPrompt = {
  area: string
  text: string
}

export type DailyPromptResponse = {
  prompts: DailyPrompt[]
  text: string
  sourceEntryIds: string[]
}

export type SearchResult = {
  journalId: string
  title: string
  type: JournalType
  date: string
  snippet: string
  score: number
}

export type RelatedEntry = SearchResult

const MAX_QUERY_LENGTH = 500

export function fetchSummary(journalId: string): Promise<SummaryResponse> {
  return apiPost('/api/ai/summary', { journalId })
}

export function fetchDailyPrompt(): Promise<DailyPromptResponse> {
  return apiPost('/api/ai/daily-prompt', {})
}

export function fetchRelated(journalId: string, limit?: number): Promise<{ related: RelatedEntry[] }> {
  return apiPost('/api/rag/related', { journalId, ...(limit != null ? { limit } : {}) })
}

function assertValidQuery(query: string): string {
  const trimmed = query.trim()
  if (!trimmed) throw new Error('empty query')
  if (trimmed.length > MAX_QUERY_LENGTH) throw new Error('query too long')
  return trimmed
}

export function searchKeyword(query: string): Promise<{ results: SearchResult[] }> {
  const trimmed = assertValidQuery(query)
  return apiPost('/api/rag/search/keyword', { query: trimmed })
}

export function searchSemantic(query: string): Promise<{ results: SearchResult[] }> {
  const trimmed = assertValidQuery(query)
  return apiPost('/api/rag/search/semantic', { query: trimmed })
}
