import type { Card, CardDirection, Deck } from './deck'

/* A room is one instance of a deck being played by one group. Its Firestore
 * document id IS its code, so joining is a direct lookup with no query and no
 * index. This module holds the pure logic: everything here is testable without
 * Firebase, a browser, or a network. */

/** No O, 0, I, or 1: a code gets read aloud across a table and typed on a
 *  phone, so the glyph pairs people confuse are excluded outright. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const ROOM_CODE_LENGTH = 6

export interface RoomPlayer {
  /** Null for someone who joined the table without signing in. */
  uid: string | null
  name: string
  photoURL: string | null
}

export interface Room {
  code: string
  deckId: string
  title: string
  hostUid: string
  hostName: string
  status: 'active' | 'ended'
  /** Shuffled indexes into the deck's `cards` array. */
  order: number[]
  /** How many cards have been turned over so far. */
  drawn: number
  /** Is the card on top of the pile face up. */
  revealed: boolean
  players: RoomPlayer[]
  answerCount: number
  createdAt?: unknown
  updatedAt?: unknown
  endedAt?: unknown
}

export interface Answer {
  id: string
  cardId: string
  cardIndex: number
  /** Copied at record time so an edit to the deck never rewrites an answer. */
  prompt: string
  direction: CardDirection
  uid: string
  name: string
  photoURL: string | null
  s3Key: string
  durationMs: number
  mimeType: string
  transcript: string
  transcriptStatus: 'ready' | 'failed'
  createdAt?: unknown
}

export function generateRoomCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)]
  }
  return code
}

/** Clean up what a person typed into the join box: uppercase, drop anything
 *  outside the alphabet (spaces, dashes they added themselves), and cap it. */
export function normalizeRoomCode(input: string): string {
  return input
    .toUpperCase()
    .split('')
    .filter((ch) => ROOM_CODE_ALPHABET.includes(ch))
    .join('')
    .slice(0, ROOM_CODE_LENGTH)
}

/** Fisher-Yates over 0..count-1, with an injectable random source for tests. */
export function shuffleOrder(count: number, random: () => number = Math.random): number[] {
  const order = Array.from({ length: count }, (_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

/** The card currently face up (or face down) on top of the pile. Null before
 *  the first draw, and null if the stored order outlives a shrunken deck. */
export function currentCard(room: Room, deck: Deck): Card | null {
  if (room.drawn < 1) return null
  const index = room.order[room.drawn - 1]
  return deck.cards[index] ?? null
}

export function isExhausted(room: Room): boolean {
  return room.drawn >= room.order.length
}

/** Cards already played, most recent first, for the discard pile review. */
export function discardPile(room: Room, deck: Deck): Card[] {
  return room.order
    .slice(0, Math.max(0, room.drawn))
    .map((i) => deck.cards[i])
    .filter((c): c is Card => Boolean(c))
    .reverse()
}
