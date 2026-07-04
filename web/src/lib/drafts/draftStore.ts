import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

// IndexedDB draft store — port of iOS `DraftEntry`/`DraftStore`
// (`ios/LuminaLog/Core/Models/DraftEntry.swift`,
// `ios/LuminaLog/Core/Persistence/DraftStore.swift`). A draft is a
// locally-persisted in-progress journal entry: it lives only between the
// start of composition and the moment the user taps Save (after which the
// entry is durable via Firestore). M2 is text-only; `attachments` stays in
// the shape for parity with iOS but is always `[]` until M4 wires media.
//
// Epochs are SECONDS since 1970 (matches iOS `Double` epoch), not JS
// milliseconds — callers must divide `Date.now()` by 1000.

export type DraftAttachmentKind = 'photo' | 'video' | 'audio'

export interface DraftAttachment {
  id: string
  kind: DraftAttachmentKind
  fileName: string
  durationSec?: number
  pixelWidth?: number
  pixelHeight?: number
  order: number
}

export interface DraftEntry {
  draftId: string
  text: string
  promptText?: string
  createdAtEpoch: number
  updatedAtEpoch: number
  attachments: DraftAttachment[]
}

interface DraftsDB extends DBSchema {
  drafts: {
    key: string
    value: DraftEntry
  }
}

const DB_NAME = 'luminalog'
const STORE_NAME = 'drafts'

let dbPromise: Promise<IDBPDatabase<DraftsDB>> | undefined

// Lazy singleton. Never touches `indexedDB` at module load time (SSR-safe) —
// only when a caller actually invokes a function below, and only from the
// browser (these APIs are client-only; callers use them from `'use client'`
// components/effects).
function getDB(): Promise<IDBPDatabase<DraftsDB>> {
  if (typeof indexedDB === 'undefined') {
    throw new Error('draftStore: indexedDB is unavailable (this module is client-only)')
  }
  if (!dbPromise) {
    dbPromise = openDB<DraftsDB>(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'draftId' })
        }
      },
    })
  }
  return dbPromise
}

function assertDraftId(draftId: string): void {
  if (!draftId) throw new Error('draftStore: draftId must not be empty')
}

/** Upsert a draft. Caller is responsible for setting `updatedAtEpoch`. */
export async function putDraft(draft: DraftEntry): Promise<void> {
  assertDraftId(draft.draftId)
  const db = await getDB()
  await db.put(STORE_NAME, draft)
}

export async function getDraft(draftId: string): Promise<DraftEntry | undefined> {
  assertDraftId(draftId)
  const db = await getDB()
  return db.get(STORE_NAME, draftId)
}

/** All drafts, newest (by `updatedAtEpoch`) first. */
export async function listDrafts(): Promise<DraftEntry[]> {
  const db = await getDB()
  const all = await db.getAll(STORE_NAME)
  return all.sort((a, b) => b.updatedAtEpoch - a.updatedAtEpoch)
}

export async function deleteDraft(draftId: string): Promise<void> {
  assertDraftId(draftId)
  const db = await getDB()
  await db.delete(STORE_NAME, draftId)
}

/** True when the draft has nothing worth keeping (used to prune empties). */
export function isDraftEmpty(draft: DraftEntry): boolean {
  return draft.text.trim().length === 0 && draft.attachments.length === 0
}

/**
 * What the autosave debounce calls: prune empties instead of persisting
 * them, otherwise upsert. Matches the iOS "delete-on-save"/prune-empty
 * lifecycle described in the design spec §9.
 */
export async function saveOrPruneDraft(draft: DraftEntry): Promise<void> {
  if (isDraftEmpty(draft)) {
    await deleteDraft(draft.draftId)
  } else {
    await putDraft(draft)
  }
}

export function newDraftId(): string {
  return crypto.randomUUID()
}
