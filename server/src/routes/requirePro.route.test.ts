import { vi, describe, it, expect } from 'vitest'

// Proves `requirePro` is actually WIRED onto the paid routes, and equally that
// it is NOT wired onto the free ones. The guard's own behavior is covered by
// middleware/requirePro.test.ts; this asserts the wiring, using the same
// router-stack-inspection approach as aiConsent.route.test.ts (supertest is not
// a dependency of this server, and Express names each stack layer after its
// handler function). The free/paid split is the load-bearing product decision
// here (indexing and vector storage stay free so an upgrade needs no backfill),
// so a regression in either direction should fail a test.
//
// The mock block mirrors aiConsent.route.test.ts: ai.ts/chat.ts pull in a wide
// service graph (Together AI, ffmpeg, S3, the Base/CDP chain stack, Firestore)
// purely to be importable, and none of it matters for reading route stacks.

vi.mock('../middleware/firebaseAuth', () => ({
  firebaseAuth: (req: any, _res: any, next: any) => { req.uid = 'u'; next() },
  db: { collection: () => ({ doc: () => ({ async get() { return { exists: false } } }) }) },
}))
vi.mock('../config', () => ({
  config: {},
  enforceAiConsentEnabled: () => false,
  enforceProEnabled: () => false,
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
}))
vi.mock('../services/ragStore', () => ({
  indexEntryChunks: vi.fn(),
  deleteEntryChunks: vi.fn(),
  searchChunks: vi.fn(),
  getEntryDayIndex: vi.fn(),
}))
vi.mock('../services/constellation/constellationService', () => ({
  updateConstellationForDay: vi.fn(),
}))
vi.mock('../services/ragGraph', () => ({ computeJournalGraph: vi.fn() }))
vi.mock('../services/summaryGenerator', () => ({
  generateSummaryText: vi.fn(),
  generateEntryAI: vi.fn(),
}))

import { aiRouter } from './ai'
import { chatRouter } from './chat'
import { ragRouter } from './rag'

interface RouteLayer {
  route?: { path: string; stack: Array<{ name: string }> }
}

/** Names of the middleware/handler chain Express registered for `path` on `router`. */
function handlerNames(router: { stack: RouteLayer[] }, path: string): string[] {
  const layer = router.stack.find(l => l.route?.path === path)
  if (!layer?.route) throw new Error(`no route registered for path ${path}`)
  return layer.route.stack.map(h => h.name)
}

describe('requirePro is wired onto the paid consumption routes', () => {
  it.each([
    '/summary',
    '/entry-ai',
    '/entry-map',
    '/daily-prompt',
    '/daily-report',
  ])('%s is Pro-gated on aiRouter', (path) => {
    const names = handlerNames(aiRouter, path)
    expect(names, `${path}: [${names.join(', ')}]`).toContain('requirePro')
  })

  it("POST /v1/ai/chat/ ('/' on chatRouter) is Pro-gated", () => {
    expect(handlerNames(chatRouter, '/')).toContain('requirePro')
  })

  it.each(['/search', '/graph'])('%s is Pro-gated on ragRouter', (path) => {
    const names = handlerNames(ragRouter, path)
    expect(names, `${path}: [${names.join(', ')}]`).toContain('requirePro')
  })

  it('runs after firebaseAuth, which is what sets req.uid', () => {
    const names = handlerNames(aiRouter, '/summary')
    expect(names.indexOf('requirePro')).toBeGreaterThan(names.indexOf('firebaseAuth'))
  })

  it('runs before requireAiConsent, so a free user is asked to pay, not to consent', () => {
    const names = handlerNames(aiRouter, '/summary')
    expect(names.indexOf('requirePro')).toBeLessThan(names.indexOf('requireAiConsent'))
  })
})

describe('requirePro is deliberately absent from the free routes', () => {
  // Indexing stays free so that pre-indexed free entries make an upgrade
  // instant, with no re-index migration owed on every upgrade forever.
  it('PUT /v1/rag/index is not Pro-gated', () => {
    expect(handlerNames(ragRouter, '/index')).not.toContain('requirePro')
  })

  it('DELETE /v1/rag/:entryId is not Pro-gated', () => {
    expect(handlerNames(ragRouter, '/:entryId')).not.toContain('requirePro')
  })
})
