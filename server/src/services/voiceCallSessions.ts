import crypto from 'crypto'
import type { ProfileFields } from './profileContext'

/**
 * A live voice-call session, held in ORDINARY server RAM (never a TEE, never
 * disk, never logged) for the duration of a Vapi custom-LLM call. It carries the
 * client's DEK so the per-turn RAG proxy can decrypt the user's past journal
 * entries mid-call, plus the per-call plaintext context the client sends once at
 * call start. Evicted on the end-of-call webhook or by the TTL backstop.
 */
export interface VoiceCallSession {
  uid: string
  chatId: string
  /** The 32-byte data-encryption key. NEVER log this. */
  dek: Buffer
  name: string
  bio: string
  profile: ProfileFields
  todayContext: string
  focalEntry?: string
  now?: string
  expiresAt: number
  /**
   * DIAGNOSTIC (voice cut-off investigation). Number of assistant CONTENT
   * CHARACTERS the proxy streamed on the previous turn of this call. Compared
   * against the length of the assistant message Vapi echoes back in the next
   * turn's history: if Vapi's copy is SHORTER, the spoken turn was cut short
   * (barge-in / TTS abort) rather than the model stopping on its own. Lengths
   * only — never the text itself.
   */
  lastStreamedChars?: number
  /** DIAGNOSTIC: 1-based turn counter within this call, for log correlation. */
  turnSeq?: number
  /**
   * The most recent turn's dedup fingerprint + a promise for its final spoken
   * text. Vapi's custom-LLM connector can retry an unresolved turn by opening a
   * BRAND NEW request with the identical `messages` history rather than waiting
   * on the original one, which previously made the proxy re-run RAG and a fresh
   * non-deterministic completion for every retry. A retry now matches this
   * fingerprint and awaits the SAME promise instead of starting over. The
   * promise is intentionally left in place after it resolves (never cleared
   * back to undefined) so a LATE duplicate arriving after the turn already
   * completed still gets the identical cached answer; it is only replaced when
   * a genuinely new turn (a different message history) begins.
   */
  pendingTurn?: { fingerprint: string; textPromise: Promise<string> }
}

export interface CreateSessionData {
  uid: string
  chatId: string
  dek: Buffer
  name: string
  bio: string
  profile: ProfileFields
  todayContext: string
  focalEntry?: string
  now?: string
}

// 30-minute TTL backstop: even if the end-of-call webhook never fires (dropped
// call, crash), the DEK cannot linger in RAM beyond this window.
const TTL_MS = 30 * 60 * 1000

const sessions = new Map<string, VoiceCallSession>()

/** Drop every expired session. Cheap linear sweep, run lazily on each access. */
function sweep(nowMs = Date.now()): void {
  for (const [token, session] of sessions) {
    if (session.expiresAt <= nowMs) sessions.delete(token)
  }
}

/**
 * Create a session and return its unguessable token. The token is the ONLY
 * credential for the per-call `/llm/:token` proxy endpoint.
 */
export function createSession(data: CreateSessionData): string {
  sweep()
  const token = crypto.randomBytes(24).toString('hex')
  sessions.set(token, { ...data, expiresAt: Date.now() + TTL_MS })
  return token
}

/** Look a session up by token; returns undefined if missing or expired. */
export function getSession(token: string): VoiceCallSession | undefined {
  sweep()
  const session = sessions.get(token)
  if (!session) return undefined
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token)
    return undefined
  }
  return session
}

/** Evict a session by token (idempotent). */
export function evictSession(token: string): void {
  sessions.delete(token)
}

/**
 * Evict every session for a chatId (idempotent). Called from the end-of-call
 * webhook, which knows the chatId but not the per-call token, so the DEK leaves
 * RAM the moment the call ends.
 */
export function evictByChatId(chatId: string): void {
  if (!chatId) return
  for (const [token, session] of sessions) {
    if (session.chatId === chatId) sessions.delete(token)
  }
}

/** Test-only: wipe all sessions. */
export function _clearAllSessions(): void {
  sessions.clear()
}
