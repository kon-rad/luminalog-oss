import { Router, Request, Response } from 'express'
import { randomUUID } from 'crypto'
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import admin from 'firebase-admin'
import { firebaseAuth, db } from '../middleware/firebaseAuth'
import { config, deepgramEnabled } from '../config'
import { s3 } from '../services/s3'
import { transcribeWithDeepgram, transcribeAudio } from '../services/aiClient'

/**
 * Card game: public, attributed, spoken answers to a shared deck of prompts.
 *
 * This is a deliberate exception to the zero-knowledge rule that governs the
 * rest of the product. Journal media is encrypted on the client and lives under
 * `users/<uid>/`; card-game audio is public by design and lives under
 * `public/cardgame/`. The two prefixes never overlap, and every endpoint here
 * refuses to touch a key outside its own. See
 * docs/superpowers/specs/2026-08-18-card-game-design.md.
 *
 * The server owns only what a client must not be trusted with: minting a room,
 * minting an upload URL, and writing an attributed answer. Flip state is
 * written directly by the browser under Firestore rules, which is what keeps
 * every phone at the table in sync without a socket.
 */

/** No O, 0, I, or 1: a code is read aloud across a table and typed on a phone. */
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ROOM_CODE_LENGTH = 6
const ROOM_CODE_ATTEMPTS = 8

export const CARD_GAME_PREFIX = 'public/cardgame/'
const ROOMS = 'cardGameRooms'
const MAX_CARDS = 500
const MAX_PLAYBACK_KEYS = 200
const MAX_DURATION_MS = 10 * 60 * 1000

export function generateRoomCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)]
  }
  return code
}

export function shuffleOrder(count: number, random: () => number = Math.random): number[] {
  const order = Array.from({ length: count }, (_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

/** True only for a key that lives inside the public card-game prefix. The
 *  traversal check matters because `playback` is unauthenticated: this test is
 *  the only thing between it and every encrypted journal object in the bucket. */
export function isCardGameKey(key: unknown): boolean {
  return typeof key === 'string' && key.startsWith(CARD_GAME_PREFIX) && !key.includes('..')
}

/** Strip anything that could escape a path segment. */
const sanitize = (value: unknown, max = 32) =>
  typeof value === 'string' ? value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, max) : ''

/** Attribution comes from the verified ID token, never from the request body.
 *  Apple sign-in frequently omits the name claim, so fall back to something
 *  neutral rather than writing an empty byline into a public archive. */
function attribution(req: Request): { uid: string; name: string; photoURL: string | null } {
  const uid = (req as any).uid as string
  const token = ((req as any).token ?? {}) as { name?: string; picture?: string }
  const name = typeof token.name === 'string' && token.name.trim() ? token.name.trim() : 'Guest founder'
  const photoURL = typeof token.picture === 'string' && token.picture ? token.picture : null
  return { uid, name, photoURL }
}

const roomRef = (code: string) => db.collection(ROOMS).doc(code)

/** Load an active room, answering the request itself when it cannot be played. */
async function loadPlayableRoom(code: string, res: Response): Promise<any | null> {
  if (!code || code.length !== ROOM_CODE_LENGTH) {
    res.status(400).json({ error: 'Invalid room code' })
    return null
  }
  const snap = await roomRef(code).get()
  if (!snap.exists) {
    res.status(404).json({ error: 'Room not found' })
    return null
  }
  const room = snap.data()
  if (room?.status !== 'active') {
    res.status(409).json({ error: 'This game has ended' })
    return null
  }
  return room
}

export async function createRoomHandler(req: Request, res: Response): Promise<void> {
  const { uid, name } = attribution(req)
  const { deckId, cardCount, title } = (req.body ?? {}) as {
    deckId?: string; cardCount?: number; title?: string
  }

  if (typeof deckId !== 'string' || !deckId) {
    res.status(400).json({ error: 'Missing deckId' }); return
  }
  if (!Number.isInteger(cardCount) || (cardCount as number) < 1 || (cardCount as number) > MAX_CARDS) {
    res.status(400).json({ error: `cardCount must be an integer between 1 and ${MAX_CARDS}` }); return
  }

  try {
    // Retry on collision so a fresh game can never land on top of a live one.
    for (let attempt = 0; attempt < ROOM_CODE_ATTEMPTS; attempt++) {
      const code = generateRoomCode()
      const ref = roomRef(code)
      const existing = await ref.get()
      if (existing.exists) continue

      await ref.set({
        code,
        deckId,
        title: typeof title === 'string' ? title.slice(0, 120) : '',
        hostUid: uid,
        hostName: name,
        status: 'active',
        order: shuffleOrder(cardCount as number),
        drawn: 0,
        revealed: false,
        players: [],
        answerCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        endedAt: null,
      })
      res.json({ code })
      return
    }
    res.status(503).json({ error: 'Could not allocate a room code, please retry' })
  } catch (err) {
    console.error('[cardgame/rooms] create failed', err)
    res.status(500).json({ error: 'Failed to create the game' })
  }
}

export async function answerUploadUrlHandler(req: Request, res: Response): Promise<void> {
  const code = sanitize(req.params?.code, ROOM_CODE_LENGTH)
  const room = await loadPlayableRoom(code, res)
  if (!room) return

  const { ext, contentType } = (req.body ?? {}) as { ext?: string; contentType?: string }
  const cleanExt = sanitize(ext, 8).toLowerCase() || 'webm'
  const answerId = randomUUID()
  const s3Key = `${CARD_GAME_PREFIX}${code}/${answerId}.${cleanExt}`

  try {
    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: config.AWS_S3_BUCKET,
        Key: s3Key,
        ContentType: typeof contentType === 'string' ? contentType : 'application/octet-stream',
      }),
      { expiresIn: 3600 },
    )
    res.json({ answerId, s3Key, uploadUrl })
  } catch (err) {
    console.error('[cardgame/upload-url]', err)
    res.status(500).json({ error: 'Failed to prepare the upload' })
  }
}

/** Pull the object back out of S3 so it can be transcribed. The audio went up
 *  directly from the browser, so this is the first time the server sees it. */
async function fetchObject(s3Key: string): Promise<Buffer> {
  const obj: any = await s3.send(
    new GetObjectCommand({ Bucket: config.AWS_S3_BUCKET, Key: s3Key }),
  )
  const bytes = await obj.Body.transformToByteArray()
  return Buffer.from(bytes)
}

/** Deepgram first, Whisper as the fallback. Deepgram has been observed
 *  returning HTTP 200 with an empty transcript on a real recording, so an empty
 *  result is treated as a failure exactly as transcribeClip.ts treats it. */
async function transcribe(buffer: Buffer, contentType: string): Promise<string> {
  let text = ''
  if (deepgramEnabled()) {
    try {
      text = await transcribeWithDeepgram(buffer, contentType)
    } catch (err) {
      console.error('[cardgame] Deepgram failed, falling back to Whisper:', err)
    }
    if (!text.trim()) {
      console.warn('[cardgame] Deepgram returned empty, trying Whisper')
      text = await transcribeAudio(buffer, 'answer.webm')
    }
  } else {
    text = await transcribeAudio(buffer, 'answer.webm')
  }
  return text
}

export async function createAnswerHandler(req: Request, res: Response): Promise<void> {
  const code = sanitize(req.params?.code, ROOM_CODE_LENGTH)
  const room = await loadPlayableRoom(code, res)
  if (!room) return

  const { uid, name, photoURL } = attribution(req)
  const { answerId, s3Key, cardId, cardIndex, prompt, direction, durationMs, mimeType } =
    (req.body ?? {}) as Record<string, any>

  if (typeof answerId !== 'string' || !answerId) {
    res.status(400).json({ error: 'Missing answerId' }); return
  }
  // The key must be one this server minted for THIS room, not merely one that
  // happens to sit under the public prefix.
  if (!isCardGameKey(s3Key) || !String(s3Key).startsWith(`${CARD_GAME_PREFIX}${code}/${answerId}.`)) {
    res.status(403).json({ error: 'That upload does not belong to this game' }); return
  }
  if (typeof cardId !== 'string' || !cardId || typeof prompt !== 'string' || !prompt) {
    res.status(400).json({ error: 'Missing cardId or prompt' }); return
  }

  const contentType = typeof mimeType === 'string' && mimeType ? mimeType : 'audio/webm'

  // Transcription is best effort. The recording is the artifact that matters,
  // so a transcriber outage must never cost the table the answer it just gave.
  let transcript = ''
  let transcriptStatus: 'ready' | 'failed' = 'ready'
  try {
    const buffer = await fetchObject(s3Key)
    transcript = (await transcribe(buffer, contentType)).trim()
    if (!transcript) transcriptStatus = 'failed'
  } catch (err) {
    console.error('[cardgame/answers] transcription failed', err)
    transcriptStatus = 'failed'
  }

  const answer = {
    id: answerId,
    cardId,
    cardIndex: Number.isInteger(cardIndex) ? cardIndex : 0,
    prompt: prompt.slice(0, 500),
    direction: direction === 'elder-to-younger' ? 'elder-to-younger' : 'younger-to-elder',
    uid,
    name,
    photoURL,
    s3Key,
    durationMs: Number.isFinite(durationMs) ? Math.min(Math.max(0, durationMs), MAX_DURATION_MS) : 0,
    mimeType: contentType,
    transcript,
    transcriptStatus,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }

  try {
    await roomRef(code).collection('answers').doc(answerId).set(answer)
    await roomRef(code).update({
      answerCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    res.json({ answer: { ...answer, createdAt: null } })
  } catch (err) {
    console.error('[cardgame/answers] write failed', err)
    res.status(500).json({ error: 'Failed to save the answer' })
  }
}

/** Public, unauthenticated: the games are public, so anyone may play the audio.
 *  The prefix check is what keeps that from meaning anyone may read anything. */
export async function playbackHandler(req: Request, res: Response): Promise<void> {
  const { s3Keys } = (req.body ?? {}) as { s3Keys?: unknown }
  if (!Array.isArray(s3Keys) || s3Keys.length === 0) {
    res.status(400).json({ error: 'Missing s3Keys array' }); return
  }
  if (s3Keys.length > MAX_PLAYBACK_KEYS) {
    res.status(400).json({ error: `At most ${MAX_PLAYBACK_KEYS} keys per request` }); return
  }
  if (!s3Keys.every(isCardGameKey)) {
    res.status(403).json({ error: 'Cannot access keys outside the card game' }); return
  }

  try {
    const urls = await Promise.all(
      (s3Keys as string[]).map(async (s3Key) => ({
        s3Key,
        playbackUrl: await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: config.AWS_S3_BUCKET, Key: s3Key }),
          { expiresIn: 3600 },
        ),
      })),
    )
    res.json({ urls })
  } catch (err) {
    console.error('[cardgame/playback]', err)
    res.status(500).json({ error: 'Failed to prepare playback' })
  }
}

export const cardGameRouter = Router()

cardGameRouter.post('/rooms', firebaseAuth, createRoomHandler)
cardGameRouter.post('/rooms/:code/answers/upload-url', firebaseAuth, answerUploadUrlHandler)
cardGameRouter.post('/rooms/:code/answers', firebaseAuth, createAnswerHandler)
// Public: the games are public, and the prefix guard does the authorization.
cardGameRouter.post('/playback', playbackHandler)
