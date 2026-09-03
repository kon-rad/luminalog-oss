import { createHash, randomUUID } from 'crypto'
import { generatePeriodNarrative } from './index'
import type { PeriodType } from '../periodCentroid/periodIndex'
import type { PeriodNarrativeDayInput } from './chunk'

/**
 * In-memory registry for period-narrative generations, identical in shape and
 * reasoning to `cognitiveMap/jobs.ts`: the map-reduce pipeline can run several
 * sequential LLM calls for a large period, which no client can hold a request open
 * for. `POST /v1/ai/period-narrative` starts a job here and returns a ticket; the
 * client polls until the narrative is ready.
 *
 * ZERO KNOWLEDGE: the period's plaintext beats live in the runner's closure for the
 * life of the job, and the derived paragraph lives in this registry until fetched or
 * expired. Neither is written to disk, Firestore, or a log line.
 *
 * SINGLE PROCESS: `luminalog-api` runs as one PM2 process, so a plain Map is a
 * correct registry. A restart drops every in-flight job; the client re-POSTs.
 */

export type PeriodNarrativeJobStatus = 'pending' | 'done' | 'failed'
export interface PeriodNarrativeResult { narrative: string; model: string; generatedAt: string }

export interface PeriodNarrativeJob {
  id: string
  uid: string
  contentHash: string
  status: PeriodNarrativeJobStatus
  createdAt: number
  finishedAt?: number
  result?: PeriodNarrativeResult
  error?: string
}

/** How long a finished job stays readable. */
export const RESULT_TTL_MS = 15 * 60_000
/** A job still pending past this is declared failed, so a wedged call cannot hold a slot. */
export const PENDING_TIMEOUT_MS = 6 * 60_000
export const REAP_INTERVAL_MS = 60_000
export const MAX_JOBS = 500
/** Concurrent generations. Caps what a launch backlog can fire into the provider at once. */
export const MAX_CONCURRENT = 4

const jobs = new Map<string, PeriodNarrativeJob>()
const queue: Array<() => void> = []
let running = 0

/** Namespaced by uid, periodType and periodIndex, and the actual beat content, so a
 * later edit that changes the beats (invalidation, per the design spec) starts a
 * fresh job rather than replaying a stale one. */
function contentHashFor(
  uid: string, periodType: PeriodType, periodIndex: number, days: PeriodNarrativeDayInput[],
): string {
  return createHash('sha256')
    .update(`${uid}\n${periodType}\n${periodIndex}\n${JSON.stringify(days)}`)
    .digest('hex')
}

function isExpired(job: PeriodNarrativeJob, now: number): boolean {
  if (job.status === 'pending') return false
  return now - (job.finishedAt ?? job.createdAt) > RESULT_TTL_MS
}

function failIfStalled(job: PeriodNarrativeJob, now: number): void {
  if (job.status !== 'pending') return
  if (now - job.createdAt <= PENDING_TIMEOUT_MS) return
  job.status = 'failed'
  job.error = 'Period narrative generation timed out'
  job.finishedAt = now
}

function findLive(uid: string, contentHash: string, now: number): PeriodNarrativeJob | undefined {
  for (const job of jobs.values()) {
    if (job.uid !== uid || job.contentHash !== contentHash) continue
    failIfStalled(job, now)
    if (isExpired(job, now)) continue
    return job
  }
  return undefined
}

function evictIfOverCapacity(): void {
  if (jobs.size <= MAX_JOBS) return
  const byAge = [...jobs.values()].sort((a, b) => a.createdAt - b.createdAt)
  const order = [
    ...byAge.filter(j => j.status !== 'pending'),
    ...byAge.filter(j => j.status === 'pending'),
  ]
  for (const job of order) {
    if (jobs.size <= MAX_JOBS) return
    jobs.delete(job.id)
  }
}

function run(job: PeriodNarrativeJob, periodType: PeriodType, days: PeriodNarrativeDayInput[]): void {
  running += 1
  generatePeriodNarrative({ periodType, days })
    .then(result => {
      job.status = 'done'
      job.result = result
    })
    .catch((err: unknown) => {
      job.status = 'failed'
      job.error = err instanceof Error ? err.message : 'Period narrative generation failed'
    })
    .finally(() => {
      job.finishedAt = Date.now()
      running -= 1
      queue.shift()?.()
    })
}

/**
 * Start a generation, or return the id of the live job already generating this exact
 * period (same user, periodType, periodIndex, and beats) so a duplicate client call
 * shares one generation instead of paying for two.
 */
export function startPeriodNarrativeJob(
  uid: string,
  periodType: PeriodType,
  periodIndex: number,
  days: PeriodNarrativeDayInput[],
  now: number = Date.now(),
): string {
  const contentHash = contentHashFor(uid, periodType, periodIndex, days)
  const existing = findLive(uid, contentHash, now)
  if (existing) return existing.id

  const job: PeriodNarrativeJob = { id: randomUUID(), uid, contentHash, status: 'pending', createdAt: now }
  jobs.set(job.id, job)
  evictIfOverCapacity()

  if (running < MAX_CONCURRENT) run(job, periodType, days)
  else queue.push(() => run(job, periodType, days))

  return job.id
}

/**
 * Read a job. Returns undefined for an unknown id, an expired job, and any job
 * belonging to another user, so a leaked id is indistinguishable from a wrong one.
 */
export function getPeriodNarrativeJob(
  uid: string, jobId: string, now: number = Date.now(),
): PeriodNarrativeJob | undefined {
  const job = jobs.get(jobId)
  if (!job || job.uid !== uid) return undefined
  failIfStalled(job, now)
  if (isExpired(job, now)) {
    jobs.delete(job.id)
    return undefined
  }
  return job
}

/** Drop expired jobs and fail stalled ones. Called on an interval, and by tests. */
export function reapPeriodNarrativeJobs(now: number = Date.now()): void {
  for (const job of [...jobs.values()]) {
    failIfStalled(job, now)
    if (isExpired(job, now)) jobs.delete(job.id)
  }
}

export function resetPeriodNarrativeJobsForTests(): void {
  jobs.clear()
  queue.length = 0
  running = 0
}

// Unref'd so it never holds the process open, in production or under vitest.
setInterval(() => reapPeriodNarrativeJobs(), REAP_INTERVAL_MS).unref()
