// Pure, decoded domain models — the in-app shape used by React/hooks. These
// mirror the iOS `Core/Models` structs (JournalEntry, UserProfile, Stats, …)
// but in their DECODED form: dates are JS `Date`, and `title`/`content` are
// already-decrypted plaintext strings (the on-wire envelopes live only in the
// Firestore document maps handled by `codec.ts`). See web-app design §3/§6.

/** The four journal entry types. */
export type JournalType = 'text' | 'voice' | 'video' | 'image'

/** Kind of a media attachment stored in S3. */
export type MediaKind = 'image' | 'video' | 'audio'

/** RAG indexing state for an entry (`vector` field in Firestore). */
export interface VectorState {
  status: 'indexed' | 'pending' | 'failed'
  chunkCount: number
  indexedAt?: Date
}

/** A single media attachment on a journal entry. */
export interface MediaItem {
  s3Key: string
  kind: string
  durationSec?: number
  width?: number
  height?: number
  thumbnailS3Key?: string
}

/** On-device speech-to-text state for voice/video entries. */
export type TranscriptStatus = 'ready' | 'processing' | 'failed'

/** Background save-pipeline state; `undefined` once fully settled. */
export type ProcessingStatus =
  | 'processing'
  | 'uploading'
  | 'saving'
  | 'transcribing'
  | 'ready'
  | 'failed'

/** A timestamped record of a user edit to an entry's title/content. */
export interface EditRecord {
  editedAt: Date
  fields: string[]
}

/** AI-generated summary/insights text attached to an entry. */
export interface AIGeneration {
  text: string
  generatedAt: Date
  model?: string
}

/** AI-generated journaling prompts attached to an entry. */
export interface AIPrompts {
  items: string[]
  generatedAt: Date
  model?: string
}

/** A journal entry — `journals/{journalId}`, decoded. */
export interface JournalEntry {
  id: string
  userId: string
  type: JournalType
  /** Already-decrypted plaintext. */
  title: string
  /** Already-decrypted plaintext (typed body / transcript / OCR text). */
  content: string
  createdAt: Date
  updatedAt: Date
  contentEditedAt?: Date
  editHistory?: EditRecord[]
  media: MediaItem[]
  transcriptStatus?: TranscriptStatus
  processingStatus?: ProcessingStatus
  summary?: AIGeneration
  insights?: AIGeneration
  prompts?: AIPrompts
  vector: VectorState
  wordCount: number
  excludeFromShare: boolean
  /** The prompt text answered to create this entry (absent for un-prompted). */
  promptText?: string
}

/** Journaling stats maintained transactionally on every save (design §8). */
export interface Stats {
  streakCount: number
  /** Best-ever value of `streakCount` (monotonic). */
  maxStreakCount: number
  totalWords: number
  /** Words journaled so far on `goalDayDate`. */
  goalDayWords: number
  promptsAnswered: number
  /** The last *qualifying* day (its entries reached the goal). */
  lastEntryDate?: Date
  /** Calendar day (user timezone) that `goalDayWords` accumulates for. */
  goalDayDate?: Date
}

/** Per-type media storage counters (plaintext — not sensitive). */
export interface StorageStats {
  audioBytes: number
  audioCount: number
  imageBytes: number
  imageCount: number
  videoBytes: number
  videoCount: number
}

/** The user document — `users/{uid}`, decoded. Only the M1/M2-relevant fields
 *  are modelled precisely; later sub-objects (dailyPrompt, summaryConfig,
 *  profileDetails, constellation, wallet, nft) are left as typed-later stubs so
 *  a decode never drops them but M2 doesn't over-model what it never touches. */
export interface UserProfile {
  id: string
  displayName: string
  email: string
  photoURL?: string
  /** Already-decrypted plaintext (''-fallback if absent/undecryptable). */
  biography: string
  createdAt: Date
  /** IANA timezone identifier (e.g. "America/Los_Angeles"). */
  timezone: string
  totalMinutesInApp: number
  voiceCredits?: number
  stats: Stats
  storage: StorageStats
  /** Later-milestone sub-objects; carried through un-decoded for now. */
  dailyPrompt?: unknown
  summaryConfig?: unknown
  profileDetails?: unknown
  constellation?: unknown
  wallet?: unknown
  nft?: unknown
}
