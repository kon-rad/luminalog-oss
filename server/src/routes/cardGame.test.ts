import { vi, describe, it, expect, beforeEach } from 'vitest'

// Echo presigner: the returned URL embeds the key it was asked to sign, so a
// test can assert which Key reached S3 without any network.
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(async (_client: any, cmd: any) => `https://signed/${cmd.input.Key}`),
}))

const mocks = vi.hoisted(() => ({
  s3Send: vi.fn(async () => ({
    Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
  })),
  transcribeWithDeepgram: vi.fn(async () => 'deepgram transcript'),
  transcribeAudio: vi.fn(async () => 'whisper transcript'),
}))
const { s3Send, transcribeWithDeepgram, transcribeAudio } = mocks

vi.mock('../services/s3', () => ({ s3: { send: mocks.s3Send } }))
vi.mock('../services/aiClient', () => ({
  transcribeWithDeepgram: mocks.transcribeWithDeepgram,
  transcribeAudio: mocks.transcribeAudio,
}))

vi.mock('../config', () => ({
  config: { AWS_S3_BUCKET: 'test-bucket' },
  deepgramEnabled: () => true,
}))

/* Minimal in-memory Firestore stand-in: documents keyed by path, with the
 * subset of the Admin SDK surface these handlers touch. Built inside
 * vi.hoisted so the mock factory below can close over it. */
const store = vi.hoisted(() => {
  const docs = new Map<string, any>()
  const state: { existsOverride: ((path: string) => boolean) | null } = { existsOverride: null }

  const makeCollection = (path: string) => ({ doc: (id: string) => makeDoc(`${path}/${id}`) })

  const makeDoc = (path: string): any => ({
    path,
    get: async () => ({
      exists: state.existsOverride ? state.existsOverride(path) : docs.has(path),
      id: path.split('/').pop(),
      data: () => docs.get(path),
    }),
    set: async (data: any) => { docs.set(path, { ...data }) },
    update: async (data: any) => { docs.set(path, { ...docs.get(path), ...data }) },
    collection: (name: string) => makeCollection(`${path}/${name}`),
  })

  return {
    docs,
    state,
    db: { collection: (name: string) => makeCollection(name) },
  }
})

const { docs, state } = store

vi.mock('../middleware/firebaseAuth', () => ({ db: store.db, firebaseAuth: vi.fn() }))
vi.mock('firebase-admin', () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => 'TS', increment: (n: number) => ({ inc: n }) } } },
}))

import {
  createRoomHandler,
  answerUploadUrlHandler,
  createAnswerHandler,
  playbackHandler,
  isCardGameKey,
  CARD_GAME_PREFIX,
} from './cardGame'

function mockRes() {
  const res: any = { statusCode: 200 }
  res.status = vi.fn((c: number) => { res.statusCode = c; return res })
  res.json = vi.fn((b: any) => { res.body = b; return res })
  return res
}

const TOKEN = { name: 'Ada Lovelace', picture: 'https://img/ada.png' }

function seedRoom(code: string, over: any = {}) {
  docs.set(`cardGameRooms/${code}`, {
    code, deckId: 'bridging-generations', status: 'active',
    order: [3, 1, 2], drawn: 1, revealed: true, players: [], answerCount: 0,
    ...over,
  })
}

beforeEach(() => {
  docs.clear()
  state.existsOverride = null
  vi.clearAllMocks()
  transcribeWithDeepgram.mockResolvedValue('deepgram transcript')
  transcribeAudio.mockResolvedValue('whisper transcript')
  s3Send.mockResolvedValue({ Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } })
})

describe('isCardGameKey', () => {
  it('accepts a key under the public card-game prefix', () => {
    expect(isCardGameKey(`${CARD_GAME_PREFIX}ABC234/x.webm`)).toBe(true)
  })

  // The whole point of the separate prefix: a card-game endpoint must never be
  // able to reach an encrypted journal object under users/<uid>/.
  it('rejects a journal media key', () => {
    expect(isCardGameKey('users/u1/journals/J1/audio-x.m4a')).toBe(false)
  })

  it('rejects a traversal attempt out of the prefix', () => {
    expect(isCardGameKey(`${CARD_GAME_PREFIX}../users/u1/secret.m4a`)).toBe(false)
  })
})

describe('createRoomHandler', () => {
  it('creates a room whose document id is the returned code', async () => {
    const req: any = { uid: 'u1', token: TOKEN, body: { deckId: 'bridging-generations', cardCount: 100 } }
    const res = mockRes()
    await createRoomHandler(req, res)
    expect(res.statusCode).toBe(200)
    const code = res.body.code as string
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)
    const room = docs.get(`cardGameRooms/${code}`)
    expect(room.hostUid).toBe('u1')
    expect(room.hostName).toBe('Ada Lovelace')
    expect(room.status).toBe('active')
    expect(room.drawn).toBe(0)
    expect(room.revealed).toBe(false)
  })

  it('shuffles a full permutation of the deck', async () => {
    const req: any = { uid: 'u1', token: TOKEN, body: { deckId: 'bridging-generations', cardCount: 100 } }
    const res = mockRes()
    await createRoomHandler(req, res)
    const room = docs.get(`cardGameRooms/${res.body.code}`)
    expect([...room.order].sort((a: number, b: number) => a - b)).toEqual(
      Array.from({ length: 100 }, (_, i) => i),
    )
  })

  it('retries on a code collision instead of overwriting a live game', async () => {
    let calls = 0
    state.existsOverride = () => { calls += 1; return calls === 1 }
    const req: any = { uid: 'u1', token: TOKEN, body: { deckId: 'bridging-generations', cardCount: 100 } }
    const res = mockRes()
    await createRoomHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(calls).toBeGreaterThan(1)
  })

  it('rejects an implausible card count', async () => {
    const req: any = { uid: 'u1', token: TOKEN, body: { deckId: 'bridging-generations', cardCount: 100000 } }
    const res = mockRes()
    await createRoomHandler(req, res)
    expect(res.statusCode).toBe(400)
  })
})

describe('answerUploadUrlHandler', () => {
  it('mints a key under the public card-game prefix for that room', async () => {
    seedRoom('ABC234')
    const req: any = { uid: 'u1', token: TOKEN, params: { code: 'ABC234' }, body: { ext: 'webm', contentType: 'audio/webm' } }
    const res = mockRes()
    await answerUploadUrlHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.s3Key).toBe(`${CARD_GAME_PREFIX}ABC234/${res.body.answerId}.webm`)
    expect(res.body.uploadUrl).toBe(`https://signed/${res.body.s3Key}`)
  })

  it('sanitizes a hostile extension rather than writing it into the key', async () => {
    seedRoom('ABC234')
    const req: any = { uid: 'u1', token: TOKEN, params: { code: 'ABC234' }, body: { ext: '../../evil', contentType: 'audio/webm' } }
    const res = mockRes()
    await answerUploadUrlHandler(req, res)
    expect(isCardGameKey(res.body.s3Key)).toBe(true)
    expect(res.body.s3Key).not.toContain('..')
  })

  it('404s for a room that does not exist', async () => {
    const req: any = { uid: 'u1', token: TOKEN, params: { code: 'NOPE22' }, body: { ext: 'webm', contentType: 'audio/webm' } }
    const res = mockRes()
    await answerUploadUrlHandler(req, res)
    expect(res.statusCode).toBe(404)
  })

  it('409s for a room that has ended', async () => {
    seedRoom('ABC234', { status: 'ended' })
    const req: any = { uid: 'u1', token: TOKEN, params: { code: 'ABC234' }, body: { ext: 'webm', contentType: 'audio/webm' } }
    const res = mockRes()
    await answerUploadUrlHandler(req, res)
    expect(res.statusCode).toBe(409)
  })
})

describe('createAnswerHandler', () => {
  const answerId = '11111111-2222-3333-4444-555555555555'
  const body = {
    answerId,
    s3Key: `${CARD_GAME_PREFIX}ABC234/${answerId}.webm`,
    cardId: 'bg-001',
    cardIndex: 0,
    prompt: 'What did you believe at 25?',
    direction: 'younger-to-elder',
    durationMs: 42000,
    mimeType: 'audio/webm',
  }

  it('persists the answer with the Deepgram transcript', async () => {
    seedRoom('ABC234')
    const req: any = { uid: 'u1', token: TOKEN, params: { code: 'ABC234' }, body }
    const res = mockRes()
    await createAnswerHandler(req, res)
    expect(res.statusCode).toBe(200)
    const saved = docs.get(`cardGameRooms/ABC234/answers/${answerId}`)
    expect(saved.transcript).toBe('deepgram transcript')
    expect(saved.transcriptStatus).toBe('ready')
    expect(saved.prompt).toBe('What did you believe at 25?')
  })

  // Attribution is the whole value of the archive, so it comes from the verified
  // token and never from anything the caller can set.
  it('takes attribution from the verified token and ignores the request body', async () => {
    seedRoom('ABC234')
    const req: any = {
      uid: 'u1', token: TOKEN, params: { code: 'ABC234' },
      body: { ...body, name: 'Somebody Else', uid: 'u-victim', photoURL: 'https://evil/x.png' },
    }
    const res = mockRes()
    await createAnswerHandler(req, res)
    const saved = docs.get(`cardGameRooms/ABC234/answers/${answerId}`)
    expect(saved.name).toBe('Ada Lovelace')
    expect(saved.uid).toBe('u1')
    expect(saved.photoURL).toBe('https://img/ada.png')
  })

  it('rejects an s3Key outside the room prefix', async () => {
    seedRoom('ABC234')
    const req: any = { uid: 'u1', token: TOKEN, params: { code: 'ABC234' }, body: { ...body, s3Key: 'users/u2/journals/J1/audio.m4a' } }
    const res = mockRes()
    await createAnswerHandler(req, res)
    expect(res.statusCode).toBe(403)
  })

  it('rejects an s3Key belonging to a different room', async () => {
    seedRoom('ABC234')
    const req: any = { uid: 'u1', token: TOKEN, params: { code: 'ABC234' }, body: { ...body, s3Key: `${CARD_GAME_PREFIX}ZZZ999/${answerId}.webm` } }
    const res = mockRes()
    await createAnswerHandler(req, res)
    expect(res.statusCode).toBe(403)
  })

  // Deepgram has been observed returning HTTP 200 with an empty transcript on a
  // real recording. That silent failure must not reach the archive as an empty
  // answer, so it falls through to Whisper exactly as transcribeClip does.
  it('falls back to Whisper when Deepgram returns an empty transcript', async () => {
    seedRoom('ABC234')
    transcribeWithDeepgram.mockResolvedValue('   ')
    const req: any = { uid: 'u1', token: TOKEN, params: { code: 'ABC234' }, body }
    const res = mockRes()
    await createAnswerHandler(req, res)
    expect(transcribeAudio).toHaveBeenCalled()
    expect(docs.get(`cardGameRooms/ABC234/answers/${answerId}`).transcript).toBe('whisper transcript')
  })

  it('falls back to Whisper when Deepgram throws', async () => {
    seedRoom('ABC234')
    transcribeWithDeepgram.mockRejectedValue(new Error('deepgram down'))
    const req: any = { uid: 'u1', token: TOKEN, params: { code: 'ABC234' }, body }
    const res = mockRes()
    await createAnswerHandler(req, res)
    expect(docs.get(`cardGameRooms/ABC234/answers/${answerId}`).transcript).toBe('whisper transcript')
  })

  // The audio is the artifact that matters. A transcription outage must never
  // cost the table the recording it just made.
  it('still persists the answer when every transcriber fails', async () => {
    seedRoom('ABC234')
    transcribeWithDeepgram.mockRejectedValue(new Error('deepgram down'))
    transcribeAudio.mockRejectedValue(new Error('whisper down'))
    const req: any = { uid: 'u1', token: TOKEN, params: { code: 'ABC234' }, body }
    const res = mockRes()
    await createAnswerHandler(req, res)
    expect(res.statusCode).toBe(200)
    const saved = docs.get(`cardGameRooms/ABC234/answers/${answerId}`)
    expect(saved.transcriptStatus).toBe('failed')
    expect(saved.s3Key).toBe(body.s3Key)
  })

  it('409s for a room that has ended', async () => {
    seedRoom('ABC234', { status: 'ended' })
    const req: any = { uid: 'u1', token: TOKEN, params: { code: 'ABC234' }, body }
    const res = mockRes()
    await createAnswerHandler(req, res)
    expect(res.statusCode).toBe(409)
  })

  it('falls back to a neutral display name when the token carries none', async () => {
    seedRoom('ABC234')
    const req: any = { uid: 'u1', token: {}, params: { code: 'ABC234' }, body }
    const res = mockRes()
    await createAnswerHandler(req, res)
    const saved = docs.get(`cardGameRooms/ABC234/answers/${answerId}`)
    expect(saved.name).toBe('Guest founder')
    expect(saved.photoURL).toBeNull()
  })
})

describe('playbackHandler', () => {
  it('signs keys inside the public card-game prefix', async () => {
    const key = `${CARD_GAME_PREFIX}ABC234/a.webm`
    const req: any = { body: { s3Keys: [key] } }
    const res = mockRes()
    await playbackHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.urls).toEqual([{ s3Key: key, playbackUrl: `https://signed/${key}` }])
  })

  // This endpoint is unauthenticated, so the prefix check is the only thing
  // standing between it and every encrypted journal object in the bucket.
  it('refuses to sign a journal media key', async () => {
    const req: any = { body: { s3Keys: ['users/u1/journals/J1/audio-x.m4a'] } }
    const res = mockRes()
    await playbackHandler(req, res)
    expect(res.statusCode).toBe(403)
  })

  it('rejects the whole batch when one key is outside the prefix', async () => {
    const req: any = { body: { s3Keys: [`${CARD_GAME_PREFIX}ABC234/a.webm`, 'users/u1/x.m4a'] } }
    const res = mockRes()
    await playbackHandler(req, res)
    expect(res.statusCode).toBe(403)
  })

  it('400s on a missing key list', async () => {
    const req: any = { body: {} }
    const res = mockRes()
    await playbackHandler(req, res)
    expect(res.statusCode).toBe(400)
  })

  it('caps an oversized batch', async () => {
    const req: any = { body: { s3Keys: Array.from({ length: 300 }, (_, i) => `${CARD_GAME_PREFIX}ABC234/${i}.webm`) } }
    const res = mockRes()
    await playbackHandler(req, res)
    expect(res.statusCode).toBe(400)
  })
})
