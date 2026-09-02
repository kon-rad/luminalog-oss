import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('./index', () => ({ generateEntryMap: vi.fn() }))

import { generateEntryMap } from './index'
import {
  startMapJob, getMapJob, reapJobs, resetJobsForTests,
  RESULT_TTL_MS, PENDING_TIMEOUT_MS, MAX_CONCURRENT,
} from './jobs'

const MAP = {
  v: 1 as const, beats: [], edges: [], model: 'm', generatedAt: '2026-08-24T00:00:00.000Z',
}

/** A promise plus the handles to settle it, so a test can hold a job pending. */
function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

/** A generation that never settles, for tests that only care about the pending state. */
function neverSettles() {
  vi.mocked(generateEntryMap).mockReturnValue(deferred<typeof MAP>().promise as any)
}

beforeEach(() => { vi.clearAllMocks(); resetJobsForTests() })
afterEach(() => { resetJobsForTests() })

describe('startMapJob', () => {
  it('returns a pending job that becomes done with the generated map', async () => {
    vi.mocked(generateEntryMap).mockResolvedValue(MAP)
    const id = startMapJob('u1', 'Some words.')

    expect(getMapJob('u1', id)?.status).toBe('pending')
    await vi.waitFor(() => expect(getMapJob('u1', id)?.status).toBe('done'))
    expect(getMapJob('u1', id)?.result).toEqual(MAP)
  })

  it('becomes failed, carrying the error message, when generation throws', async () => {
    vi.mocked(generateEntryMap).mockRejectedValue(new Error('every model refused'))
    const id = startMapJob('u1', 'Some words.')

    await vi.waitFor(() => expect(getMapJob('u1', id)?.status).toBe('failed'))
    expect(getMapJob('u1', id)?.error).toBe('every model refused')
  })

  it('reuses the live job for identical content from the same user', () => {
    neverSettles()
    const first = startMapJob('u1', 'Some words.')
    const second = startMapJob('u1', 'Some words.')

    expect(second).toBe(first)
    expect(generateEntryMap).toHaveBeenCalledTimes(1)
  })

  it('starts a separate job for different content', () => {
    neverSettles()
    const first = startMapJob('u1', 'Some words.')
    const second = startMapJob('u1', 'Other words.')

    expect(second).not.toBe(first)
    expect(generateEntryMap).toHaveBeenCalledTimes(2)
  })

  it('does not share a job between users, even for identical content', () => {
    neverSettles()
    const mine = startMapJob('u1', 'Some words.')
    const theirs = startMapJob('u2', 'Some words.')

    expect(theirs).not.toBe(mine)
  })

  it('queues past the concurrency cap and drains as jobs finish', async () => {
    const gates = Array.from({ length: MAX_CONCURRENT + 1 }, () => deferred<typeof MAP>())
    let call = 0
    vi.mocked(generateEntryMap).mockImplementation(() => gates[call++].promise as any)

    const ids = gates.map((_, i) => startMapJob('u1', `entry ${i}`))
    expect(generateEntryMap).toHaveBeenCalledTimes(MAX_CONCURRENT)

    gates[0].resolve(MAP)
    await vi.waitFor(() => expect(generateEntryMap).toHaveBeenCalledTimes(MAX_CONCURRENT + 1))
    await vi.waitFor(() => expect(getMapJob('u1', ids[0])?.status).toBe('done'))
  })
})

describe('getMapJob', () => {
  it('hides another user\'s job', () => {
    neverSettles()
    const id = startMapJob('u1', 'Some words.')

    expect(getMapJob('u2', id)).toBeUndefined()
  })

  it('is undefined for an unknown id', () => {
    expect(getMapJob('u1', 'no-such-job')).toBeUndefined()
  })

  it('fails a job left pending past the timeout', () => {
    neverSettles()
    const id = startMapJob('u1', 'Some words.', 1_000)

    const job = getMapJob('u1', id, 1_000 + PENDING_TIMEOUT_MS + 1)
    expect(job?.status).toBe('failed')
  })

  it('drops a finished job once its result TTL is past', async () => {
    vi.mocked(generateEntryMap).mockResolvedValue(MAP)
    const id = startMapJob('u1', 'Some words.', 1_000)
    await vi.waitFor(() => expect(getMapJob('u1', id, 1_000)?.status).toBe('done'))

    expect(getMapJob('u1', id, Date.now() + RESULT_TTL_MS + 1)).toBeUndefined()
  })

  it('reissues a job for the same content after the old one expired', async () => {
    vi.mocked(generateEntryMap).mockResolvedValue(MAP)
    const first = startMapJob('u1', 'Some words.')
    await vi.waitFor(() => expect(getMapJob('u1', first)?.status).toBe('done'))

    reapJobs(Date.now() + RESULT_TTL_MS + 1)
    const second = startMapJob('u1', 'Some words.')
    expect(second).not.toBe(first)
  })
})
