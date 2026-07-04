// The top-level `journals/{journalId}` repository — web port of iOS
// `Core/Persistence/FirestoreJournalRepository.swift` (design §6). Handles the
// exact text-entry create mapping, the live decrypted entry stream, targeted
// content/edit updates, exclude-from-share, delete, and the fire-and-forget
// `POST /v1/rag/index` trigger (design §10). Every read/write filters on the
// caller's own `uid` (via `auth.currentUser`) — no cross-tenant access, and no
// external caller can pass a different uid in.

import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { AAD } from '@/lib/crypto/aad'
import { encryptField } from '@/lib/crypto/envelope'
import { bootstrapDEK, getCachedDEK } from '@/lib/crypto/dek'
import { apiPost } from '@/lib/api/client'
import { decodeEntry, encodeTextEntryCreate } from '@/lib/firestore/codec'
import { wordCount } from '@/lib/wordCount'
import type { JournalEntry } from '@/lib/firestore/models'

const COLLECTION = 'journals'

const requireUser = () => {
  const user = auth.currentUser
  if (!user) throw new Error('journals: no signed-in user')
  return user
}

const requireDEK = async (): Promise<CryptoKey> => getCachedDEK() ?? (await bootstrapDEK())

export interface CreateTextEntryInput {
  title: string
  content: string
  /** When the user tapped Save (= entry `createdAt`); defaults to now. */
  createdAt?: Date
  /** Present only when seeded from a prompt. */
  promptText?: string
}

/**
 * Create a text `journals/{journalId}` document with the EXACT create mapping
 * (design §6): a single `setDoc` whose `title`/`content` are encrypted
 * envelopes, `vector` starts `{status:'pending',chunkCount:0}`, and
 * `excludeFromShare` is always written `false`. `id` defaults to a fresh
 * `crypto.randomUUID()` but the caller may pass one (the Create screen reuses
 * the draft's id, matching iOS). Returns the entry id.
 *
 * The passed-in `id` may collide with an already-saved entry (e.g. a stale
 * resumed draft whose id matches a doc that was already saved and has since
 * been server-enriched with `vector`/`summary`/`insights`/`prompts`). A bare
 * `setDoc` would clobber that whole map. So: if the doc already exists, this
 * degrades to a targeted `updateDoc` of just the user-owned fields
 * (title/content/wordCount/updatedAt), leaving server-owned fields intact.
 */
export const createTextEntry = async (
  input: CreateTextEntryInput,
  id?: string,
): Promise<string> => {
  const user = requireUser()
  const dek = await requireDEK()
  const journalId = id ?? crypto.randomUUID()
  const now = new Date()
  const ref = doc(db, COLLECTION, journalId)

  const existing = await getDoc(ref)
  if (existing.exists()) {
    await updateDoc(ref, {
      title: await encryptField(dek, input.title, AAD.journalsTitle),
      content: await encryptField(dek, input.content, AAD.journalsContent),
      wordCount: wordCount(input.content),
      updatedAt: serverTimestamp(),
    })
    return journalId
  }

  const map = await encodeTextEntryCreate(
    {
      userId: user.uid,
      title: input.title,
      content: input.content,
      createdAt: input.createdAt ?? now,
      updatedAt: now,
      wordCount: wordCount(input.content),
      promptText: input.promptText,
    },
    dek,
  )

  await setDoc(ref, map)
  return journalId
}

/**
 * Live-stream the decoded entries for `uid`, newest first
 * (`where('userId','==',uid).orderBy('createdAt','desc')` — requires the
 * composite index from design §6). Each snapshot decodes every doc with the
 * cached DEK (bootstrapping it if needed); entries whose required fields fail
 * to decrypt are DROPPED (fail-closed, matches `decodeEntry`). Returns the
 * unsubscribe function.
 */
export const streamEntries = (
  uid: string,
  onData: (entries: JournalEntry[]) => void,
  onError?: (e: unknown) => void,
): (() => void) => {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
  )

  // Two rapid snapshots can have their (async) decodes settle out of order;
  // a monotonic sequence number lets us drop a decode that resolves after a
  // NEWER snapshot's decode has already delivered `onData`, so an older
  // result can never clobber a newer one.
  let latestSeq = 0

  return onSnapshot(
    q,
    (snap) => {
      const seq = ++latestSeq
      requireDEK()
        .then(async (dek) => {
          const decoded = await Promise.all(
            snap.docs.map((d) => decodeEntry(d.id, d.data() as DocumentData, dek)),
          )
          if (seq !== latestSeq) return
          onData(decoded.filter((e): e is JournalEntry => e !== null))
        })
        .catch((err) => {
          console.warn(`[journals] failed to decode stream for uid=${uid}:`, String(err))
          onError?.(err)
        })
    },
    (err) => {
      console.warn(`[journals] snapshot listener error (uid=${uid}):`, String(err))
      onError?.(err)
    },
  )
}

/** Fetch and decode a single entry; `null` if missing or fails to decrypt. */
export const getEntry = async (id: string): Promise<JournalEntry | null> => {
  const dek = await requireDEK()
  const snap = await getDoc(doc(db, COLLECTION, id))
  if (!snap.exists()) return null
  return decodeEntry(id, snap.data() as DocumentData, dek)
}

/**
 * Update an entry's body text (design §6 "Update content"): encrypts
 * `content`, recomputes `wordCount`, stamps `contentEditedAt` with a client
 * `Timestamp`, and writes `updatedAt` as a SERVER timestamp (client ts on
 * create, server ts on edit — faithfully reproduces iOS).
 */
export const updateContent = async (
  id: string,
  content: string,
  contentEditedAt?: Date,
): Promise<void> => {
  const dek = await requireDEK()
  await updateDoc(doc(db, COLLECTION, id), {
    content: await encryptField(dek, content, AAD.journalsContent),
    wordCount: wordCount(content),
    contentEditedAt: Timestamp.fromDate(contentEditedAt ?? new Date()),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Apply a full title+content edit, appending an `editHistory` record (which
 * fields changed) via `arrayUnion`. `updatedAt` is a server timestamp.
 */
export const applyEntryEdit = async (
  id: string,
  title: string,
  content: string,
  editFields: string[],
): Promise<void> => {
  const dek = await requireDEK()
  await updateDoc(doc(db, COLLECTION, id), {
    title: await encryptField(dek, title, AAD.journalsTitle),
    content: await encryptField(dek, content, AAD.journalsContent),
    wordCount: wordCount(content),
    updatedAt: serverTimestamp(),
    editHistory: arrayUnion({ editedAt: Timestamp.now(), fields: editFields }),
  })
}

/** Toggle whether an entry is excluded from share/report generation. */
export const setExcludeFromShare = async (id: string, value: boolean): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, id), { excludeFromShare: value })
}

/**
 * Delete an entry. RAG/S3 cleanup (`DELETE /v1/rag/delete`) is a later
 * milestone — not called here (design §6).
 */
export const deleteEntry = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, id))
}

/**
 * Fire-and-forget `POST /v1/rag/index` (design §10). Swallows any failure —
 * the server re-reads the doc and reconciles `vector.status`, so there is no
 * client-side retry.
 */
export const requestIndex = async (journalId: string): Promise<void> => {
  try {
    await apiPost('/api/rag/index', { journalId })
  } catch {
    // Swallowed by design — server reconciles vector status independently.
  }
}
