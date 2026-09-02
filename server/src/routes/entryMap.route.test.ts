import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../services/cognitiveMap/jobs', () => ({
  startMapJob: vi.fn(),
  getMapJob: vi.fn(),
}))
// ai.ts pulls in a wide service graph (AI client, ffmpeg audio extraction, S3, the
// Base/CDP chain stack, Firestore, and config.ts which process.exit(1)s without a
// validated env) purely to be importable. None of it matters here, so it is all
// mocked to the bare minimum needed for a clean import. Mirrors the precedent in
// aiConsent.route.test.ts.
vi.mock('../middleware/firebaseAuth', () => ({ firebaseAuth: vi.fn(), db: {} }))
vi.mock('../middleware/requireAiConsent', () => ({ requireAiConsent: vi.fn() }))
vi.mock('../config', () => ({
  config: {},
  enforceAiConsentEnabled: () => false,
  chainEnabled: () => false,
}))
vi.mock('firebase-admin', () => ({
  default: {
    firestore: { FieldValue: { serverTimestamp: () => ({ __serverTimestamp: true }) } },
  },
}))
vi.mock('../services/aiClient', () => ({
  chatCompletion: vi.fn(),
  transcribeAudio: vi.fn(),
  streamToBuffer: vi.fn(),
  activeChatModel: () => 'mock-model',
}))
vi.mock('../services/audioExtractor', () => ({ extractAudio: vi.fn() }))
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send() { return Promise.resolve() } },
  GetObjectCommand: class {},
  PutObjectCommand: class {},
}))
vi.mock('../services/chain/soulService', () => ({
  ensureSoulMinted: vi.fn(),
  refreshSoulImage: vi.fn(),
}))
vi.mock('../services/constellation/constellationService', () => ({
  updateConstellationForDay: vi.fn(),
}))
vi.mock('../services/unsplashService', () => ({ searchPhoto: vi.fn() }))
vi.mock('../services/humeService', () => ({ scoreText: vi.fn() }))

import { entryMapHandler, entryMapJobHandler } from './ai'
import { startMapJob, getMapJob } from '../services/cognitiveMap/jobs'

function mockRes() {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

beforeEach(() => { vi.clearAllMocks() })

const MAP = { v: 1, beats: [], edges: [], model: 'model-a', generatedAt: '2026-08-16T00:00:00.000Z' }

describe('entryMapHandler', () => {
  it('400s when content is missing', async () => {
    const res = mockRes()
    await entryMapHandler({ uid: 'u1', body: {} } as any, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(startMapJob).not.toHaveBeenCalled()
  })

  it('400s when content is only whitespace', async () => {
    const res = mockRes()
    await entryMapHandler({ uid: 'u1', body: { content: '   ' } } as any, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(startMapJob).not.toHaveBeenCalled()
  })

  it('202s with the ticket for the job it started', async () => {
    vi.mocked(startMapJob).mockReturnValue('job-1')
    const res = mockRes()
    await entryMapHandler({ uid: 'u1', body: { content: 'Some words.' } } as any, res)

    expect(startMapJob).toHaveBeenCalledWith('u1', 'Some words.')
    expect(res.status).toHaveBeenCalledWith(202)
    expect(res.json).toHaveBeenCalledWith({ jobId: 'job-1', status: 'pending' })
  })
})

describe('entryMapJobHandler', () => {
  it("404s an unknown, expired, or other user's job", async () => {
    vi.mocked(getMapJob).mockReturnValue(undefined)
    const res = mockRes()
    await entryMapJobHandler({ uid: 'u1', params: { jobId: 'job-1' } } as any, res)

    expect(getMapJob).toHaveBeenCalledWith('u1', 'job-1')
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('reports a pending job without a map', async () => {
    vi.mocked(getMapJob).mockReturnValue({ status: 'pending' } as any)
    const res = mockRes()
    await entryMapJobHandler({ uid: 'u1', params: { jobId: 'job-1' } } as any, res)

    expect(res.json).toHaveBeenCalledWith({ status: 'pending' })
  })

  it('returns the map when the job is done', async () => {
    vi.mocked(getMapJob).mockReturnValue({ status: 'done', result: MAP } as any)
    const res = mockRes()
    await entryMapJobHandler({ uid: 'u1', params: { jobId: 'job-1' } } as any, res)

    expect(res.json).toHaveBeenCalledWith({ status: 'done', ...MAP })
  })

  it('reports a failed job as 200 so the client can stop polling', async () => {
    vi.mocked(getMapJob).mockReturnValue({ status: 'failed', error: 'every model refused' } as any)
    const res = mockRes()
    await entryMapJobHandler({ uid: 'u1', params: { jobId: 'job-1' } } as any, res)

    expect(res.status).not.toHaveBeenCalledWith(502)
    expect(res.json).toHaveBeenCalledWith({ status: 'failed', error: 'every model refused' })
  })
})
