// The `chats/{id}` + `chats/{id}/messages/{id}` repository — web port of the
// M5 chat data layer (design §1/§2 M5-T1). The client only ever creates the
// chat doc + renames its title; every message is server-written (via the SSE
// `/v1/ai/chat` route) and the client only decodes+streams them. Every op
// filters on the caller's own `uid` (via `auth.currentUser`) — no cross-tenant
// access.

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { bootstrapDEK, getCachedDEK } from '@/lib/crypto/dek'
import {
  decodeChat,
  decodeMessage,
  encodeChatCreate,
  encodeChatTitle,
} from '@/lib/firestore/codec'
import type { Chat, ChatKind, ChatMessage } from '@/lib/firestore/models'

const COLLECTION = 'chats'
const MESSAGES_SUBCOLLECTION = 'messages'
const DELETE_BATCH_SIZE = 400

const requireUser = () => {
  const user = auth.currentUser
  if (!user) throw new Error('chats: no signed-in user')
  return user
}

const requireDEK = async (): Promise<CryptoKey> => getCachedDEK() ?? (await bootstrapDEK())

export interface CreateChatInput {
  kind?: ChatKind
  title?: string
  journalId?: string
  journalTitle?: string
}

/**
 * Create a `chats/{id}` document with the EXACT create mapping (design §1):
 * `id` is a fresh `crypto.randomUUID()`, `kind` defaults to `'text'`, `title`
 * defaults to `'New chat'`. Returns the new chat id.
 */
export const createChat = async (input: CreateChatInput = {}): Promise<string> => {
  const user = requireUser()
  const dek = await requireDEK()
  const kind: ChatKind = input.kind ?? 'text'
  const title = input.title ?? 'New chat'
  const id = crypto.randomUUID()

  const map = await encodeChatCreate(
    {
      userId: user.uid,
      kind,
      title,
      journalId: input.journalId,
      journalTitle: input.journalTitle,
    },
    dek,
  )

  await setDoc(doc(db, COLLECTION, id), map)
  return id
}

/**
 * Live-stream the decoded chats for `uid`, most-recently-active first
 * (`where('userId','==',uid).orderBy('lastMessageAt','desc')`). Fail-soft
 * decode (`decodeChat` never throws/drops on a bad title). Returns the
 * unsubscribe function.
 */
export const streamChats = (
  uid: string,
  onData: (chats: Chat[]) => void,
  onError?: (e: unknown) => void,
): (() => void) => {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', uid),
    orderBy('lastMessageAt', 'desc'),
  )

  // A monotonic sequence number guards against two rapid snapshots' async
  // decodes settling out of order (mirrors `journals.streamEntries`).
  let latestSeq = 0

  return onSnapshot(
    q,
    (snap) => {
      const seq = ++latestSeq
      requireDEK()
        .then(async (dek) => {
          const decoded = await Promise.all(
            snap.docs.map((d) => decodeChat(d.id, d.data() as DocumentData, dek)),
          )
          if (seq !== latestSeq) return
          onData(decoded)
        })
        .catch((err) => {
          console.warn(`[chats] failed to decode stream for uid=${uid}:`, String(err))
          onError?.(err)
        })
    },
    (err) => {
      console.warn(`[chats] snapshot listener error (uid=${uid}):`, String(err))
      onError?.(err)
    },
  )
}

/**
 * Live-stream the decoded messages for `chatId`, oldest first
 * (`orderBy('createdAt','asc')`). Messages whose required `text` fails to
 * decrypt are DROPPED (fail-closed, matches `decodeMessage`). Returns the
 * unsubscribe function.
 */
export const streamMessages = (
  chatId: string,
  onData: (messages: ChatMessage[]) => void,
  onError?: (e: unknown) => void,
): (() => void) => {
  const q = query(
    collection(db, COLLECTION, chatId, MESSAGES_SUBCOLLECTION),
    orderBy('createdAt', 'asc'),
  )

  let latestSeq = 0

  return onSnapshot(
    q,
    (snap) => {
      const seq = ++latestSeq
      requireDEK()
        .then(async (dek) => {
          const decoded = await Promise.all(
            snap.docs.map((d) => decodeMessage(d.id, d.data() as DocumentData, dek)),
          )
          if (seq !== latestSeq) return
          onData(decoded.filter((m): m is ChatMessage => m !== null))
        })
        .catch((err) => {
          console.warn(`[chats] failed to decode messages for chatId=${chatId}:`, String(err))
          onError?.(err)
        })
    },
    (err) => {
      console.warn(`[chats] messages listener error (chatId=${chatId}):`, String(err))
      onError?.(err)
    },
  )
}

/** Rename a chat: encrypts the new title and patches just that field. */
export const updateChatTitle = async (chatId: string, title: string): Promise<void> => {
  const dek = await requireDEK()
  await updateDoc(doc(db, COLLECTION, chatId), await encodeChatTitle(title, dek))
}

/**
 * Delete a chat and its full `messages` subcollection. Firestore has no
 * server-side cascade delete, so this pages the subcollection client-side
 * (`getDocs` capped to `DELETE_BATCH_SIZE` per query + `writeBatch` deletes)
 * until it's empty, then deletes the chat doc itself. Capping the query
 * itself (rather than fetching the whole subcollection and slicing) means
 * each loop iteration reads at most one batch, not the entire subcollection.
 */
export const deleteChat = async (chatId: string): Promise<void> => {
  const messagesRef = collection(db, COLLECTION, chatId, MESSAGES_SUBCOLLECTION)
  const messagesPage = query(messagesRef, limit(DELETE_BATCH_SIZE))

  for (;;) {
    const snap = await getDocs(messagesPage)
    if (snap.empty) break
    const batch = writeBatch(db)
    snap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()
    if (snap.docs.length < DELETE_BATCH_SIZE) break
  }

  await deleteDoc(doc(db, COLLECTION, chatId))
}
