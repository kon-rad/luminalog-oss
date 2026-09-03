import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('./index', () => ({ generatePeriodNarrative: vi.fn() }))

import { generatePeriodNarrative } from './index'
import {
  startPeriodNarrativeJob, getPeriodNarrativeJob, reapPeriodNarrativeJobs,
  resetPeriodNarrativeJobsForTests, RESULT_TTL_MS, PENDING_TIMEOUT_MS, MAX_CONCURRENT,
} from './jobs'
import type { PeriodNarrativeDayInput } from './chunk'

const RESULT = { narrative: 'You shipped the beta.', model: 'm', generatedAt: '2026-09-03T00:00:00.000Z' }

const DAYS: PeriodNarrativeDayInput[] = [
  { dayIndex: 1, beats: [{ text: 'Shipped the beta', kind: 'event', domain: 'craft', isSpine: true }] },
]

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function neverSettles() {
  vi.mocked(generatePeriodNarrative).mockReturnValue(deferred<typeof RESULT>().promise as any)
}

beforeEach(() => { vi.clearAllMocks(); resetPeriodNarrativeJobsForTests() })
afterEach(() => { resetPeriodNarrativeJobsForTests() })

describe('startPeriodNarrativeJob', () => {
  it('returns a pending job that becomes done with the generated narrative', async () => {
    vi.mocked(generatePeriodNarrative).mockResolvedValue(RESULT)
    const id = startPeriodNarrativeJob('u1', 'week', 5, DAYS)

    expect(getPeriodNarrativeJob('u1', id)?.status).toBe('pending')
    await vi.waitFor(() => expect(getPeriodNarrativeJob('u1', id)?.status).toBe('done'))
    expect(getPeriodNarrativeJob('u1', id)?.result).toEqual(RESULT)
  })

  it('becomes failed, carrying the error message, when generation throws', async () => {
    vi.mocked(generatePeriodNarrative).mockRejectedValue(new Error('every model refused'))
    const id = startPeriodNarrativeJob('u1', 'week', 5, DAYS)

    await vi.waitFor(() => expect(getPeriodNarrativeJob('u1', id)?.status).toBe('failed'))
    expect(getPeriodNarrativeJob('u1', id)?.error).toBe('every model refused')
  })

  it('reuses the live job for identical periodType/periodIndex/days from the same user', () => {
    neverSettles()
    const first = startPeriodNarrativeJob('u1', 'week', 5, DAYS)
    const second = startPeriodNarrativeJob('u1', 'week', 5, DAYS)

    expect(second).toBe(first)
    expect(generatePeriodNarrative).toHaveBeenCalledTimes(1)
  })

  it('starts a separate job for a different periodIndex', () => {
    neverSettles()
    const first = startPeriodNarrativeJob('u1', 'week', 5, DAYS)
    const second = startPeriodNarrativeJob('u1', 'week', 6, DAYS)

    expect(second).not.toBe(first)
    expect(generatePeriodNarrative).toHaveBeenCalledTimes(2)
  })

  it('does not share a job between users, even for identical periodType/periodIndex/days', () => {
    neverSettles()
    const mine = startPeriodNarrativeJob('u1', 'week', 5, DAYS)
    const theirs = startPeriodNarrativeJob('u2', 'week', 5, DAYS)

    expect(theirs).not.toBe(mine)
  })

  it('queues past the concurrency cap and drains as jobs finish', async () => {
    const gates = Array.from({ length: MAX_CONCURRENT + 1 }, () => deferred<typeof RESULT>())
    let call = 0
    vi.mocked(generatePeriodNarrative).mockImplementation(() => gates[call++].promise as any)

    const ids = gates.map((_, i) => startPeriodNarrativeJob('u1', 'week', i, DAYS))
    expect(generatePeriodNarrative).toHaveBeenCalledTimes(MAX_CONCURRENT)

    gates[0].resolve(RESULT)
    await vi.waitFor(() => expect(generatePeriodNarrative).toHaveBeenCalledTimes(MAX_CONCURRENT + 1))
    await vi.waitFor(() => expect(getPeriodNarrativeJob('u1', ids[0])?.status).toBe('done'))
  })
})

describe('getPeriodNarrativeJob', () => {
  it('hides another user\'s job', () => {
    neverSettles()
    const id = startPeriodNarrativeJob('u1', 'week', 5, DAYS)

    expect(getPeriodNarrativeJob('u2', id)).toBeUndefined()
  })

  it('is undefined for an unknown id', () => {
    expect(getPeriodNarrativeJob('u1', 'no-such-job')).toBeUndefined()
  })

  it('fails a job left pending past the timeout', () => {
    neverSettles()
    const id = startPeriodNarrativeJob('u1', 'week', 5, DAYS, 1_000)

    const job = getPeriodNarrativeJob('u1', id, 1_000 + PENDING_TIMEOUT_MS + 1)
    expect(job?.status).toBe('failed')
  })

  it('drops a finished job once its result TTL is past', async () => {
    vi.mocked(generatePeriodNarrative).mockResolvedValue(RESULT)
    const id = startPeriodNarrativeJob('u1', 'week', 5, DAYS, 1_000)
    await vi.waitFor(() => expect(getPeriodNarrativeJob('u1', id, 1_000)?.status).toBe('done'))

    expect(getPeriodNarrativeJob('u1', id, Date.now() + RESULT_TTL_MS + 1)).toBeUndefined()
  })

  it('reissues a job for the same period after the old one expired', async () => {
    vi.mocked(generatePeriodNarrative).mockResolvedValue(RESULT)
    const first = startPeriodNarrativeJob('u1', 'week', 5, DAYS)
    await vi.waitFor(() => expect(getPeriodNarrativeJob('u1', first)?.status).toBe('done'))

    reapPeriodNarrativeJobs(Date.now() + RESULT_TTL_MS + 1)
    const second = startPeriodNarrativeJob('u1', 'week', 5, DAYS)
    expect(second).not.toBe(first)
  })
})
