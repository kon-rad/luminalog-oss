import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { apiPost } from '@/lib/api/client'
import { shuffleOrder, type Answer, type Room, type RoomPlayer } from './room'

/* Browser side of the card game.
 *
 * Two different write paths on purpose:
 *   - Flip state (draw, reveal, join, restart, end) goes straight to Firestore,
 *     so every phone at the table sees it through onSnapshot with no round trip
 *     to our API. Rules restrict these writes to exactly those keys.
 *   - Anything that carries meaning (creating a room, uploading audio, saving
 *     an attributed answer) goes through the authed API, because a client must
 *     not be trusted to write it.
 */

const ROOMS = 'cardGameRooms'

const roomRef = (code: string) => doc(db, ROOMS, code)

// ---------------------------------------------------------------- reads

/** Live subscription to one room. Calls back with null when it does not exist. */
export function watchRoom(code: string, cb: (room: Room | null) => void): () => void {
  return onSnapshot(
    roomRef(code),
    (snap) => cb(snap.exists() ? ({ ...(snap.data() as Room), code: snap.id }) : null),
    (err) => {
      console.error('[card-game] room subscription failed', err)
      cb(null)
    },
  )
}

/** Live subscription to a room's answers, oldest first. */
export function watchAnswers(code: string, cb: (answers: Answer[]) => void): () => void {
  const q = query(collection(db, ROOMS, code, 'answers'), orderBy('createdAt', 'asc'))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Answer), id: d.id }))),
    (err) => {
      console.error('[card-game] answers subscription failed', err)
      cb([])
    },
  )
}

/** Live subscription to the rooms of one deck, most recent first. */
export function watchRooms(deckId: string, cb: (rooms: Room[]) => void, max = 60): () => void {
  const q = query(
    collection(db, ROOMS),
    where('deckId', '==', deckId),
    orderBy('createdAt', 'desc'),
    limit(max),
  )
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Room), code: d.id }))),
    (err) => {
      console.error('[card-game] rooms subscription failed', err)
      cb([])
    },
  )
}

// ------------------------------------------------------- flip-state writes

export async function flipCard(code: string): Promise<void> {
  await updateDoc(roomRef(code), { revealed: true, updatedAt: serverTimestamp() })
}

/** Turn the next card face down. A no-op once the deck is spent, so `drawn`
 *  can never run past the order array and strand the table on a blank card. */
export async function nextCard(code: string, room: Room): Promise<void> {
  if (room.drawn >= room.order.length) return
  await updateDoc(roomRef(code), {
    drawn: room.drawn + 1,
    revealed: false,
    updatedAt: serverTimestamp(),
  })
}

/** Two signed-out people at one table both have a null uid, so identity falls
 *  back to the display name for them. */
const samePlayer = (a: RoomPlayer, b: RoomPlayer) =>
  a.uid && b.uid ? a.uid === b.uid : !a.uid && !b.uid && a.name === b.name

export async function joinRoom(code: string, room: Room, player: RoomPlayer): Promise<void> {
  if (room.players.some((p) => samePlayer(p, player))) return
  await updateDoc(roomRef(code), {
    players: [...room.players, player],
    updatedAt: serverTimestamp(),
  })
}

export async function restartRoom(code: string, cardCount: number): Promise<void> {
  await updateDoc(roomRef(code), {
    order: shuffleOrder(cardCount),
    drawn: 0,
    revealed: false,
    updatedAt: serverTimestamp(),
  })
}

export async function endRoom(code: string): Promise<void> {
  await updateDoc(roomRef(code), {
    status: 'ended',
    endedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

// ------------------------------------------------------------ authed API

export async function createRoom(
  deckId: string,
  cardCount: number,
  title: string,
): Promise<string> {
  const res = await apiPost<{ code: string }>('/api/cardgame/rooms', { deckId, cardCount, title })
  return res.code
}

export async function requestUploadUrl(
  code: string,
  ext: string,
  contentType: string,
): Promise<{ answerId: string; s3Key: string; uploadUrl: string }> {
  return apiPost(`/api/cardgame/rooms/${code}/upload-url`, { ext, contentType })
}

export interface SubmitAnswerInput {
  answerId: string
  s3Key: string
  cardId: string
  cardIndex: number
  prompt: string
  direction: string
  durationMs: number
  mimeType: string
}

export async function submitAnswer(code: string, input: SubmitAnswerInput): Promise<Answer> {
  const res = await apiPost<{ answer: Answer }>(`/api/cardgame/rooms/${code}/answers`, input)
  return res.answer
}

/** Signed playback URLs keyed by S3 key.
 *
 *  A plain fetch, not apiPost: the games are public and a signed-out visitor
 *  must be able to hear the answers, so this must not require a Firebase token.
 *  A failure costs the page its audio players, not its transcripts and
 *  attribution, so it degrades to an empty map rather than throwing. */
export async function fetchPlaybackUrls(s3Keys: string[]): Promise<Record<string, string>> {
  if (s3Keys.length === 0) return {}
  try {
    const res = await fetch('/api/cardgame/playback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ s3Keys }),
    })
    if (!res.ok) throw new Error(`playback failed: ${res.status}`)
    const body = (await res.json()) as { urls: { s3Key: string; playbackUrl: string }[] }
    return Object.fromEntries(body.urls.map((u) => [u.s3Key, u.playbackUrl]))
  } catch (err) {
    console.error('[card-game] playback urls failed', err)
    return {}
  }
}

/** Upload the recorded blob straight to S3. The audio never passes through
 *  our API on the way up. */
export async function uploadAnswerAudio(
  uploadUrl: string,
  blob: Blob,
  contentType: string,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: blob,
  })
  if (!res.ok) throw new Error(`upload failed: ${res.status}`)
}
