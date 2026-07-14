import { vi, describe, it, expect } from 'vitest'

// Proves `requireAiConsent` is actually WIRED onto the AI routes (POST /v1/ai/*
// and POST /v1/ai/chat/) — not just that the middleware works in isolation
// (that's covered by consent.test.ts). `supertest` is not a dependency of this
// server (checked `server/package.json` + `grep -r "supertest" src/` — neither
// has it), so rather than add a new dependency for one test, this uses the
// router-stack-inspection fallback: import the REAL `aiRouter`/`chatRouter` and
// assert each route's Express `route.stack` contains a `requireAiConsent`
// handler positioned after `firebaseAuth`. Express names each stack layer after
// the handler function (`layer.name = fn.name`, see
// node_modules/express/lib/router/layer.js), so this reads the routers' actual
// wiring rather than re-testing the guard's own behavior.
//
// ai.ts/chat.ts pull in a wide service graph (Together AI client, ffmpeg audio
// extraction, S3, the Base/CDP chain stack, Firestore) purely to be importable.
// None of that matters for this test — we only need the module graph to load —
// so everything below is mocked to the bare minimum needed for a clean import.
// Mirrors soul.test.ts's precedent of mocking `chain/soulService` directly so
// the real CDP/viem chain stack is never pulled in.

vi.mock('../middleware/firebaseAuth', () => ({
  firebaseAuth: (req: any, _res: any, next: any) => { req.uid = 'u'; next() },
  db: { collection: () => ({ doc: () => ({ async get() { return { exists: false } } }) }) },
}))
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

import { aiRouter } from './ai'
import { chatRouter } from './chat'

interface RouteLayer {
  route?: { path: string; stack: Array<{ name: string }> }
}

/** Names of the middleware/handler chain Express registered for `path` on `router`. */
function handlerNames(router: { stack: RouteLayer[] }, path: string): string[] {
  const layer = router.stack.find(l => l.route?.path === path)
  if (!layer?.route) throw new Error(`no route registered for path ${path}`)
  return layer.route.stack.map(h => h.name)
}

function expectGuardedAfterAuth(names: string[], path: string): void {
  const authIdx = names.indexOf('firebaseAuth')
  const consentIdx = names.indexOf('requireAiConsent')
  expect(authIdx, `${path}: firebaseAuth not found in stack [${names.join(', ')}]`).toBeGreaterThanOrEqual(0)
  expect(consentIdx, `${path}: requireAiConsent not found in stack [${names.join(', ')}]`).toBeGreaterThanOrEqual(0)
  expect(consentIdx, `${path}: requireAiConsent must run after firebaseAuth`).toBeGreaterThan(authIdx)
}

describe('requireAiConsent is wired onto the AI routes (router-stack inspection)', () => {
  it.each([
    '/transcribe-clip',
    '/summary',
    '/entry-ai',
    '/daily-prompt',
    '/daily-report',
  ])('%s carries firebaseAuth → requireAiConsent → handler on aiRouter', (path) => {
    expectGuardedAfterAuth(handlerNames(aiRouter, path), path)
  })

  it("POST /v1/ai/chat/ ('/' on chatRouter) carries firebaseAuth → requireAiConsent → handler", () => {
    expectGuardedAfterAuth(handlerNames(chatRouter, '/'), '/')
  })
})
