import { apiGet, apiPost } from '@/lib/api/client'

export interface PeriodPositionPoint {
  periodIndex: number
  x: number
  y: number
  z: number
  childCount: number
  parentIndex: number | null
}

export interface PeriodNarrativeBeatInput {
  text: string
  kind: string
  domain: string
  isSpine: boolean
}

export interface PeriodNarrativeDayInput {
  dayIndex: number
  beats: PeriodNarrativeBeatInput[]
}

interface PeriodPositionsResponse {
  points: PeriodPositionPoint[]
}

interface PeriodNarrativeTicket {
  jobId: string
}

interface PeriodNarrativeJobResponse {
  status: 'pending' | 'done' | 'failed'
  error?: string
  narrative?: string
}

const POLL_INTERVAL_MS = 2_000
const POLL_CEILING_MS = 180_000

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/**
 * Zero-knowledge zoom-pyramid position track: one tier's positioned dots. Plain
 * read, not a job: no LLM call on this path.
 */
export async function fetchPeriodPositions(periodType: string): Promise<PeriodPositionPoint[]> {
  const response = await apiGet<PeriodPositionsResponse>(`/v1/ai/period-positions/${periodType}`)
  return response.points
}

/**
 * Zero-knowledge zoom-pyramid narrative track. Mirrors `entryMap.ts`'s
 * `pollMapJob`: POST starts a job, poll until done/failed/ceiling. Returns null on
 * any non-success outcome, mirroring that file's "missing is a far better outcome
 * than wrong" philosophy: the caller leaves whatever the renderer already shows in
 * place rather than surfacing an error state.
 *
 * `opts` is test-only: it exists so the poll loop can be walked without real waiting.
 */
export async function generatePeriodNarrative(
  periodType: string,
  periodIndex: number,
  days: PeriodNarrativeDayInput[],
  opts: { pollIntervalMs?: number; pollCeilingMs?: number } = {},
): Promise<string | null> {
  const ticket = await apiPost<PeriodNarrativeTicket>('/v1/ai/period-narrative', { periodType, periodIndex, days })
  const intervalMs = opts.pollIntervalMs ?? POLL_INTERVAL_MS
  const ceilingMs = opts.pollCeilingMs ?? POLL_CEILING_MS
  const deadline = Date.now() + ceilingMs

  while (Date.now() < deadline) {
    const job = await apiGet<PeriodNarrativeJobResponse>(`/v1/ai/period-narrative/${ticket.jobId}`)
    if (job.status === 'done') return job.narrative ?? null
    if (job.status === 'failed') return null
    await sleep(intervalMs)
  }
  return null
}
