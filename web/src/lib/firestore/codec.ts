// Encode/decode between the decoded domain models (`models.ts`) and Firestore
// document maps (`Record<string, unknown>`), handling field encryption and
// Firestore `Timestamp` ↔ JS `Date`. This is the web port of iOS
// `Core/Persistence/FirestoreMapping.swift`; every field/AAD string matches
// byte-for-byte (design §6). Required text fields are strict/fail-closed
// (`openField`); optional AI/profile text is lenient (`openFieldSafe`).

import { Timestamp } from 'firebase/firestore'
import { AAD } from '@/lib/crypto/aad'
import { encryptField, openField, openFieldSafe } from '@/lib/crypto/envelope'
import type {
  AIGeneration,
  AIPrompts,
  Chat,
  ChatKind,
  ChatMessage,
  EditRecord,
  JournalEntry,
  JournalType,
  MediaItem,
  MessageRole,
  MessageSource,
  ProcessingStatus,
  Stats,
  StorageStats,
  TranscriptStatus,
  UserProfile,
  VectorState,
} from '@/lib/firestore/models'

// --- Timestamp <-> Date ---

/** Firestore `Timestamp` (or `Date`) → `Date`; anything else → undefined. */
export const tsToDate = (v: unknown): Date | undefined => {
  if (v == null) return undefined
  if (v instanceof Date) return v
  if (typeof v === 'object' && typeof (v as { toDate?: unknown }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate()
  }
  return undefined
}

/** `Date` → Firestore `Timestamp` for writes. */
export const dateToTs = (d: Date): Timestamp => Timestamp.fromDate(d)

// --- small typed readers ---

const asString = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
const asNumber = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)
const asRecord = (v: unknown): Record<string, unknown> | undefined =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

const JOURNAL_TYPES: JournalType[] = ['text', 'voice', 'video', 'image']
const TRANSCRIPT_STATUSES: TranscriptStatus[] = ['ready', 'processing', 'failed']
const PROCESSING_STATUSES: ProcessingStatus[] = [
  'processing',
  'uploading',
  'saving',
  'transcribing',
  'ready',
  'failed',
]

// --- text entry create ---

export interface TextEntryCreateInput {
  userId: string
  title: string
  content: string
  /** When the user tapped Save (= entry `createdAt`). */
  createdAt: Date
  /** Client timestamp at create. */
  updatedAt: Date
  wordCount: number
  /** Present only when seeded from a prompt. */
  promptText?: string
}

/**
 * The EXACT create map for a text entry (design §6). Encryption is async, so
 * this returns a Promise. Omits every field that is nil on a plain text create
 * (contentEditedAt, editHistory, summary, insights, prompts, statuses, …).
 */
export const encodeTextEntryCreate = async (
  entry: TextEntryCreateInput,
  key: CryptoKey,
): Promise<Record<string, unknown>> => {
  const data: Record<string, unknown> = {
    userId: entry.userId,
    type: 'text',
    title: await encryptField(key, entry.title, AAD.journalsTitle),
    content: await encryptField(key, entry.content, AAD.journalsContent),
    createdAt: dateToTs(entry.createdAt),
    updatedAt: dateToTs(entry.updatedAt),
    media: [],
    vector: { status: 'pending', chunkCount: 0 },
    wordCount: entry.wordCount,
    excludeFromShare: false,
  }
  if (entry.promptText !== undefined) data.promptText = entry.promptText
  return data
}

// --- decode helpers (sub-objects) ---

const decodeVector = (v: unknown): VectorState => {
  const r = asRecord(v)
  const statusRaw = r && asString(r.status)
  const status =
    statusRaw === 'indexed' || statusRaw === 'pending' || statusRaw === 'failed'
      ? statusRaw
      : 'pending'
  return {
    status,
    chunkCount: (r && asNumber(r.chunkCount)) ?? 0,
    indexedAt: r ? tsToDate(r.indexedAt) : undefined,
  }
}

const decodeMedia = (v: unknown): MediaItem[] =>
  asArray(v).flatMap((item) => {
    const r = asRecord(item)
    const s3Key = r && asString(r.s3Key)
    const kind = r && asString(r.kind)
    if (!r || !s3Key || !kind) return []
    const m: MediaItem = { s3Key, kind }
    const durationSec = asNumber(r.durationSec)
    const width = asNumber(r.width)
    const height = asNumber(r.height)
    const thumb = asString(r.thumbnailS3Key)
    if (durationSec !== undefined) m.durationSec = durationSec
    if (width !== undefined) m.width = width
    if (height !== undefined) m.height = height
    if (thumb !== undefined) m.thumbnailS3Key = thumb
    return [m]
  })

const decodeEditHistory = (v: unknown): EditRecord[] =>
  asArray(v).flatMap((item) => {
    const r = asRecord(item)
    const editedAt = r ? tsToDate(r.editedAt) : undefined
    if (!editedAt) return []
    const fields = asArray(r?.fields).filter((f): f is string => typeof f === 'string')
    return [{ editedAt, fields }]
  })

const decodeAIGeneration = async (
  v: unknown,
  key: CryptoKey,
  context: string,
): Promise<AIGeneration | undefined> => {
  const r = asRecord(v)
  if (!r || r.text == null) return undefined
  const text = await openFieldSafe(key, r.text, context)
  return {
    text,
    generatedAt: tsToDate(r.generatedAt) ?? new Date(),
    model: asString(r.model),
  }
}

const decodeAIPrompts = async (v: unknown, key: CryptoKey): Promise<AIPrompts | undefined> => {
  const r = asRecord(v)
  const rawItems = r ? asArray(r.items) : []
  if (!r || rawItems.length === 0) return undefined
  const items = await Promise.all(
    rawItems.map((item, i) => openFieldSafe(key, item, AAD.journalsPromptItem(i))),
  )
  return {
    items,
    generatedAt: tsToDate(r.generatedAt) ?? new Date(),
    model: asString(r.model),
  }
}

// Warn only once when a required field fails to decrypt (fail-closed): the
// caller drops the entry; we never surface ciphertext, and we don't spam logs.
let warnedDecodeFailure = false
const warnDecodeFailureOnce = (id: string, err: unknown): void => {
  if (warnedDecodeFailure) return
  warnedDecodeFailure = true
  console.warn(`[codec] dropping journal entry ${id}: required field failed to decrypt:`, String(err))
}

// --- decode entry (fail-closed on required fields) ---

/**
 * Decode a `journals/{id}` document. Required `title`/`content` are decrypted
 * with `openField` (strict) — if either throws, the whole entry is DROPPED
 * (returns `null`, logs once) so ciphertext is never surfaced. Optional AI text
 * uses `openFieldSafe`.
 */
export const decodeEntry = async (
  id: string,
  data: Record<string, unknown>,
  key: CryptoKey,
): Promise<JournalEntry | null> => {
  const userId = asString(data.userId)
  const typeRaw = asString(data.type)
  if (!userId || !typeRaw || !JOURNAL_TYPES.includes(typeRaw as JournalType)) return null
  const type = typeRaw as JournalType

  let title: string
  let content: string
  try {
    title = await openField(key, data.title, AAD.journalsTitle)
    content = await openField(key, data.content, AAD.journalsContent)
  } catch (err) {
    warnDecodeFailureOnce(id, err)
    return null
  }

  const transcriptRaw = asString(data.transcriptStatus)
  const processingRaw = asString(data.processingStatus)

  const entry: JournalEntry = {
    id,
    userId,
    type,
    title,
    content,
    createdAt: tsToDate(data.createdAt) ?? new Date(),
    updatedAt: tsToDate(data.updatedAt) ?? new Date(),
    media: decodeMedia(data.media),
    vector: decodeVector(data.vector),
    wordCount: asNumber(data.wordCount) ?? 0,
    excludeFromShare: data.excludeFromShare === true,
  }

  const contentEditedAt = tsToDate(data.contentEditedAt)
  if (contentEditedAt) entry.contentEditedAt = contentEditedAt

  const editHistory = decodeEditHistory(data.editHistory)
  if (editHistory.length > 0) entry.editHistory = editHistory

  if (transcriptRaw && TRANSCRIPT_STATUSES.includes(transcriptRaw as TranscriptStatus)) {
    entry.transcriptStatus = transcriptRaw as TranscriptStatus
  }
  if (processingRaw && PROCESSING_STATUSES.includes(processingRaw as ProcessingStatus)) {
    entry.processingStatus = processingRaw as ProcessingStatus
  }

  const summary = await decodeAIGeneration(data.summary, key, AAD.journalsSummaryText)
  if (summary) entry.summary = summary
  const insights = await decodeAIGeneration(data.insights, key, AAD.journalsInsightsText)
  if (insights) entry.insights = insights
  const prompts = await decodeAIPrompts(data.prompts, key)
  if (prompts) entry.prompts = prompts

  const promptText = asString(data.promptText)
  if (promptText !== undefined) entry.promptText = promptText

  return entry
}

// --- stats wire format ---

/**
 * Stats wire format (design §8): always write the five counters; write
 * `lastEntryDate`/`goalDayDate` as `Timestamp` ONLY when set (omit otherwise).
 */
export const encodeStats = (stats: Stats): Record<string, unknown> => {
  const data: Record<string, unknown> = {
    streakCount: stats.streakCount,
    maxStreakCount: stats.maxStreakCount,
    totalWords: stats.totalWords,
    goalDayWords: stats.goalDayWords,
    promptsAnswered: stats.promptsAnswered,
  }
  if (stats.lastEntryDate) data.lastEntryDate = dateToTs(stats.lastEntryDate)
  if (stats.goalDayDate) data.goalDayDate = dateToTs(stats.goalDayDate)
  return data
}

export const decodeStats = (data: unknown): Stats => {
  const r = asRecord(data) ?? {}
  const stats: Stats = {
    streakCount: asNumber(r.streakCount) ?? 0,
    maxStreakCount: asNumber(r.maxStreakCount) ?? 0,
    totalWords: asNumber(r.totalWords) ?? 0,
    goalDayWords: asNumber(r.goalDayWords) ?? 0,
    promptsAnswered: asNumber(r.promptsAnswered) ?? 0,
  }
  const lastEntryDate = tsToDate(r.lastEntryDate)
  if (lastEntryDate) stats.lastEntryDate = lastEntryDate
  const goalDayDate = tsToDate(r.goalDayDate)
  if (goalDayDate) stats.goalDayDate = goalDayDate
  return stats
}

const decodeStorage = (data: unknown): StorageStats => {
  const r = asRecord(data) ?? {}
  return {
    audioBytes: asNumber(r.audioBytes) ?? 0,
    audioCount: asNumber(r.audioCount) ?? 0,
    imageBytes: asNumber(r.imageBytes) ?? 0,
    imageCount: asNumber(r.imageCount) ?? 0,
    videoBytes: asNumber(r.videoBytes) ?? 0,
    videoCount: asNumber(r.videoCount) ?? 0,
  }
}

// --- decode profile (fail-soft) ---

/**
 * Decode a `users/{uid}` document. `biography` is decrypted leniently
 * (`openFieldSafe`, '' fallback); everything else is fail-soft with sane
 * defaults. Later-milestone sub-objects are carried through un-decoded.
 */
export const decodeProfile = async (
  uid: string,
  data: Record<string, unknown>,
  key: CryptoKey,
): Promise<UserProfile> => {
  const biography = await openFieldSafe(key, data.biography, AAD.usersBiography)
  const profile: UserProfile = {
    id: uid,
    displayName: asString(data.displayName) ?? '',
    email: asString(data.email) ?? '',
    biography,
    createdAt: tsToDate(data.createdAt) ?? new Date(),
    timezone: asString(data.timezone) ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    totalMinutesInApp: asNumber(data.totalMinutesInApp) ?? 0,
    stats: decodeStats(data.stats),
    storage: decodeStorage(data.storage),
  }
  const photoURL = asString(data.photoURL)
  if (photoURL !== undefined) profile.photoURL = photoURL
  const voiceCredits = asNumber(data.voiceCredits)
  if (voiceCredits !== undefined) profile.voiceCredits = voiceCredits
  if (data.dailyPrompt !== undefined) profile.dailyPrompt = data.dailyPrompt
  if (data.summaryConfig !== undefined) profile.summaryConfig = data.summaryConfig
  if (data.profileDetails !== undefined) profile.profileDetails = data.profileDetails
  if (data.constellation !== undefined) profile.constellation = data.constellation
  if (data.wallet !== undefined) profile.wallet = data.wallet
  if (data.nft !== undefined) profile.nft = data.nft
  return profile
}

// --- chat (M5) ---

const CHAT_KINDS: ChatKind[] = ['text', 'voice']
const MESSAGE_ROLES: MessageRole[] = ['user', 'assistant']

export interface ChatCreateInput {
  userId: string
  kind: ChatKind
  title: string
  journalId?: string
  journalTitle?: string
}

/**
 * The EXACT create map for a `chats/{id}` doc (design §1): `title` is
 * encrypted, `createdAt`/`lastMessageAt` both stamp "now" as client
 * `Timestamp`s, and `journalId`/`journalTitle` are written (plaintext) only
 * when provided.
 */
export const encodeChatCreate = async (
  input: ChatCreateInput,
  key: CryptoKey,
): Promise<Record<string, unknown>> => {
  const now = dateToTs(new Date())
  const data: Record<string, unknown> = {
    userId: input.userId,
    kind: input.kind,
    title: await encryptField(key, input.title, AAD.chatsTitle),
    createdAt: now,
    lastMessageAt: now,
  }
  if (input.journalId !== undefined) data.journalId = input.journalId
  if (input.journalTitle !== undefined) data.journalTitle = input.journalTitle
  return data
}

/** `{ title: <enc envelope> }` patch for renaming a chat via `updateDoc`. */
export const encodeChatTitle = async (
  title: string,
  key: CryptoKey,
): Promise<Record<string, unknown>> => ({
  title: await encryptField(key, title, AAD.chatsTitle),
})

/**
 * Decode a `chats/{id}` document. Fail-soft: `title` uses `openFieldSafe`
 * (→ '' fallback), so a chat whose title fails to decrypt still lists (shows
 * "New chat" in the UI) rather than being dropped.
 */
export const decodeChat = async (
  id: string,
  data: unknown,
  key: CryptoKey,
): Promise<Chat> => {
  const r = asRecord(data) ?? {}
  const kindRaw = asString(r.kind)
  const kind = kindRaw && CHAT_KINDS.includes(kindRaw as ChatKind) ? (kindRaw as ChatKind) : 'text'
  const title = await openFieldSafe(key, r.title, AAD.chatsTitle)

  const chat: Chat = {
    id,
    userId: asString(r.userId) ?? '',
    kind,
    title,
    createdAt: tsToDate(r.createdAt) ?? new Date(),
    lastMessageAt: tsToDate(r.lastMessageAt) ?? new Date(),
  }
  const journalId = asString(r.journalId)
  if (journalId !== undefined) chat.journalId = journalId
  const journalTitle = asString(r.journalTitle)
  if (journalTitle !== undefined) chat.journalTitle = journalTitle
  return chat
}

// Warn only once when a required message field fails to decrypt (fail-closed):
// the caller drops the message; we never surface ciphertext, and we don't spam
// logs.
let warnedMessageDecodeFailure = false
const warnMessageDecodeFailureOnce = (id: string, err: unknown): void => {
  if (warnedMessageDecodeFailure) return
  warnedMessageDecodeFailure = true
  console.warn(`[codec] dropping message ${id}: required field failed to decrypt:`, String(err))
}

const decodeMessageSources = async (
  v: unknown,
  key: CryptoKey,
): Promise<MessageSource[]> => {
  const raw = asArray(v)
  const decoded = await Promise.all(
    raw.map(async (item, i): Promise<MessageSource | null> => {
      const r = asRecord(item)
      const journalId = r && asString(r.journalId)
      if (!r || !journalId) return null
      let snippet: string
      try {
        snippet = await openField(key, r.snippet, AAD.messagesSourceSnippet(i))
      } catch {
        // Drop just this source; the message + its other sources still stand.
        return null
      }
      const title = await openFieldSafe(key, r.title, AAD.messagesSourceTitle(i))
      return {
        journalId,
        snippet,
        title,
        type: asString(r.type) ?? '',
        date: asString(r.date) ?? '',
        score: asNumber(r.score) ?? 0,
      }
    }),
  )
  return decoded.filter((s): s is MessageSource => s !== null)
}

/**
 * Decode a `chats/{id}/messages/{id}` document. `text` is REQUIRED
 * (`openField`) — if it fails to decrypt, the whole message is DROPPED
 * (returns `null`, logs once) so ciphertext is never surfaced. `sources` are
 * decoded by their array INDEX (the AAD embeds it, so order is load-bearing);
 * an individual source that fails to decrypt is dropped, the message is kept.
 */
export const decodeMessage = async (
  id: string,
  data: unknown,
  key: CryptoKey,
): Promise<ChatMessage | null> => {
  const r = asRecord(data) ?? {}
  const roleRaw = asString(r.role)
  const role = roleRaw && MESSAGE_ROLES.includes(roleRaw as MessageRole) ? (roleRaw as MessageRole) : 'assistant'

  let text: string
  try {
    text = await openField(key, r.text, AAD.messagesText)
  } catch (err) {
    warnMessageDecodeFailureOnce(id, err)
    return null
  }

  const message: ChatMessage = {
    id,
    role,
    text,
    createdAt: tsToDate(r.createdAt) ?? new Date(),
  }

  if (r.sources !== undefined) {
    const sources = await decodeMessageSources(r.sources, key)
    if (sources.length > 0) message.sources = sources
  }

  return message
}
