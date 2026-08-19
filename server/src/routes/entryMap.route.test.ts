import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../services/cognitiveMap', () => ({
  generateEntryMap: vi.fn(),
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

import { entryMapHandler } from './ai'
import { generateEntryMap } from '../services/cognitiveMap'

function mockRes() {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

beforeEach(() => { vi.clearAllMocks() })

describe('entryMapHandler', () => {
  it('400s when content is missing', async () => {
    const res = mockRes()
    await entryMapHandler({ uid: 'u1', body: {} } as any, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(generateEntryMap).not.toHaveBeenCalled()
  })

  it('400s when content is only whitespace', async () => {
    const res = mockRes()
    await entryMapHandler({ uid: 'u1', body: { content: '   ' } } as any, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(generateEntryMap).not.toHaveBeenCalled()
  })

  it('returns the generated map', async () => {
    vi.mocked(generateEntryMap).mockResolvedValue({
      v: 1, beats: [], edges: [], model: 'model-a', generatedAt: '2026-08-16T00:00:00.000Z',
    })
    const res = mockRes()
    await entryMapHandler({ uid: 'u1', body: { content: 'Some words.' } } as any, res)
    expect(res.json).toHaveBeenCalledWith({
      v: 1, beats: [], edges: [], model: 'model-a', generatedAt: '2026-08-16T00:00:00.000Z',
    })
  })

  it('passes the plaintext content straight through', async () => {
    vi.mocked(generateEntryMap).mockResolvedValue({
      v: 1, beats: [], edges: [], model: 'm', generatedAt: 'x',
    })
    await entryMapHandler({ uid: 'u1', body: { content: 'Hello there.' } } as any, mockRes())
    expect(generateEntryMap).toHaveBeenCalledWith({ content: 'Hello there.' })
  })

  it('502s when generation fails', async () => {
    vi.mocked(generateEntryMap).mockRejectedValue(new Error('every model failed'))
    const res = mockRes()
    await entryMapHandler({ uid: 'u1', body: { content: 'Some words.' } } as any, res)
    expect(res.status).toHaveBeenCalledWith(502)
  })
})
