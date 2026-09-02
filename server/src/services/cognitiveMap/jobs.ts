import { createHash, randomUUID } from 'crypto'
import { generateEntryMap } from './index'
import type { CognitiveMap } from './types'

/**
 * In-memory registry for cognitive map generations.
 *
 * WHY THIS EXISTS: the pipeline takes 85 to 190 seconds, which no client can hold a
 * request open for. `POST /v1/ai/entry-map` starts a job here and returns a ticket; the
 * client polls until the map is ready.
 *
 * ZERO KNOWLEDGE: the entry's plaintext lives in the runner's closure for the life of
 * the job, and the derived map lives in this registry until it is fetched or expires.
 * Neither is written to disk, Firestore, or a log line, and there is no DEK on this
 * path. That in-memory window is the entire difference from the synchronous version.
 *
 * SINGLE PROCESS: `luminalog-api` runs as one PM2 process, so a plain Map is a correct
 * registry. A restart drops every in-flight job, which is fine: the client re-POSTs and
 * gets a fresh one.
 */

export type MapJobStatus = 'pending' | 'done' | 'failed'
export type MapResult = CognitiveMap & { model: string; generatedAt: string }

export interface MapJob {
  id: string
  uid: string
  contentHash: string
  status: MapJobStatus
  createdAt: number
  finishedAt?: number
  result?: MapResult
  error?: string
}

/** How long a finished job stays readable. Long enough for a launch sweep to collect it. */
export const RESULT_TTL_MS = 15 * 60_000
/** A job still pending past this is declared failed, so a wedged call cannot hold a slot. */
export const PENDING_TIMEOUT_MS = 6 * 60_000
export const REAP_INTERVAL_MS = 60_000
export const MAX_JOBS = 500
/** Concurrent generations. Caps what a launch backlog can fire into the provider at once. */
export const MAX_CONCURRENT = 4

const jobs = new Map<string, MapJob>()
/** Queued starts, each holding its own plaintext in its closure. Drained as slots free. */
const queue: Array<() => void> = []
let running = 0

/** Namespaced by uid so two users writing the same sentence never share a job. */
function contentHashFor(uid: string, content: string): string {
  return createHash('sha256').update(`${uid}\n${content}`).digest('hex')
}

function isExpired(job: MapJob, now: number): boolean {
  if (job.status === 'pending') return false
  return now - (job.finishedAt ?? job.createdAt) > RESULT_TTL_MS
}

/** Pending past its deadline counts as failed, not as still working. */
function failIfStalled(job: MapJob, now: number): void {
  if (job.status !== 'pending') return
  if (now - job.createdAt <= PENDING_TIMEOUT_MS) return
  job.status = 'failed'
  job.error = 'Cognitive map generation timed out'
  job.finishedAt = now
}

function findLive(uid: string, contentHash: string, now: number): MapJob | undefined {
  for (const job of jobs.values()) {
    if (job.uid !== uid || job.contentHash !== contentHash) continue
    failIfStalled(job, now)
    if (isExpired(job, now)) continue
    return job
  }
  return undefined
}

/** Bound memory. Finished jobs go first, oldest first, and only then anything else. */
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

function run(job: MapJob, content: string): void {
  running += 1
  generateEntryMap({ content })
    .then(result => {
      job.status = 'done'
      job.result = result
    })
    .catch((err: unknown) => {
      job.status = 'failed'
      // The message only ever describes the upstream failure, never the entry.
      job.error = err instanceof Error ? err.message : 'Cognitive map generation failed'
    })
    .finally(() => {
      job.finishedAt = Date.now()
      running -= 1
      queue.shift()?.()
    })
}

/**
 * Start a generation, or return the id of the live job already generating this exact
 * content for this user. Deduping is what lets the save-time call and the Map tab's
 * later call share one generation instead of paying for two.
 */
export function startMapJob(uid: string, content: string, now: number = Date.now()): string {
  const contentHash = contentHashFor(uid, content)
  const existing = findLive(uid, contentHash, now)
  if (existing) return existing.id

  const job: MapJob = { id: randomUUID(), uid, contentHash, status: 'pending', createdAt: now }
  jobs.set(job.id, job)
  evictIfOverCapacity()

  if (running < MAX_CONCURRENT) run(job, content)
  else queue.push(() => run(job, content))

  return job.id
}

/**
 * Read a job. Returns undefined for an unknown id, an expired job, and any job belonging
 * to another user, so a leaked id is indistinguishable from a wrong one.
 */
export function getMapJob(
  uid: string, jobId: string, now: number = Date.now(),
): MapJob | undefined {
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
export function reapJobs(now: number = Date.now()): void {
  for (const job of [...jobs.values()]) {
    failIfStalled(job, now)
    if (isExpired(job, now)) jobs.delete(job.id)
  }
}

export function resetJobsForTests(): void {
  jobs.clear()
  queue.length = 0
  running = 0
}

// Unref'd so it never holds the process open, in production or under vitest.
setInterval(() => reapJobs(), REAP_INTERVAL_MS).unref()
