import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import { isEncryptedField, encryptField } from '@/lib/crypto/envelope'
import { AAD } from '@/lib/crypto/aad'
import {
  decodeChat,
  decodeMessage,
  encodeChatCreate,
  encodeChatTitle,
} from '@/lib/firestore/codec'

let key: CryptoKey

beforeAll(async () => {
  key = await crypto.subtle.importKey('raw', new Uint8Array(32), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ])
})

describe('chat codec: encodeChatCreate / decodeChat round-trip', () => {
  it('encodes the exact create map and round-trips through decodeChat', async () => {
    const map = await encodeChatCreate(
      { userId: 'user-1', kind: 'text', title: 'New chat' },
      key,
    )

    expect(map.userId).toBe('user-1')
    expect(map.kind).toBe('text')
    expect(isEncryptedField(map.title)).toBe(true)
    expect(map.createdAt).toBeInstanceOf(Timestamp)
    expect(map.lastMessageAt).toBeInstanceOf(Timestamp)
    expect('journalId' in map).toBe(false)
    expect('journalTitle' in map).toBe(false)

    const chat = await decodeChat('chat-1', map, key)
    expect(chat.id).toBe('chat-1')
    expect(chat.userId).toBe('user-1')
    expect(chat.kind).toBe('text')
    expect(chat.title).toBe('New chat')
    expect(chat.journalId).toBeUndefined()
    expect(chat.journalTitle).toBeUndefined()
  })

  it('includes journalId/journalTitle only when provided', async () => {
    const map = await encodeChatCreate(
      {
        userId: 'user-1',
        kind: 'text',
        title: 'Chat about my day',
        journalId: 'journal-42',
        journalTitle: 'My Day',
      },
      key,
    )
    expect(map.journalId).toBe('journal-42')
    expect(map.journalTitle).toBe('My Day')

    const chat = await decodeChat('chat-2', map, key)
    expect(chat.journalId).toBe('journal-42')
    expect(chat.journalTitle).toBe('My Day')
    expect(chat.title).toBe('Chat about my day')
  })

  it('decodeChat is fail-soft: a corrupt title decodes to "" instead of throwing/dropping', async () => {
    const map = await encodeChatCreate({ userId: 'user-1', kind: 'text', title: 'ok' }, key)
    map.title = 'not-an-envelope'

    const chat = await decodeChat('chat-3', map, key)
    expect(chat).not.toBeNull()
    expect(chat.title).toBe('')
    expect(chat.id).toBe('chat-3')
  })

  it('defaults kind to "text" when missing', async () => {
    const chat = await decodeChat('chat-4', { userId: 'u' }, key)
    expect(chat.kind).toBe('text')
  })
})

describe('encodeChatTitle', () => {
  it('produces a { title: <envelope> } patch that decrypts back', async () => {
    const patch = await encodeChatTitle('Renamed chat', key)
    expect(isEncryptedField(patch.title)).toBe(true)
    const chat = await decodeChat('chat-5', patch, key)
    expect(chat.title).toBe('Renamed chat')
  })
})

describe('decodeMessage', () => {
  it('decrypts text/role/createdAt for a plain message with no sources', async () => {
    const data = {
      role: 'user',
      text: await encryptField(key, 'Hello there', AAD.messagesText),
      createdAt: Timestamp.fromDate(new Date('2026-07-04T00:00:00.000Z')),
    }
    const msg = await decodeMessage('msg-1', data, key)
    expect(msg).not.toBeNull()
    expect(msg!.role).toBe('user')
    expect(msg!.text).toBe('Hello there')
    expect(msg!.sources).toBeUndefined()
  })

  it('returns null when text is corrupt (fail-closed, never surfaces ciphertext)', async () => {
    const data = {
      role: 'assistant',
      text: 'not-an-envelope',
      createdAt: Timestamp.now(),
    }
    const msg = await decodeMessage('msg-2', data, key)
    expect(msg).toBeNull()
  })

  it('decrypts sources BY INDEX, preserving order, when both snippet+title are encrypted with the index-bound AAD', async () => {
    const sources = await Promise.all(
      [
        { journalId: 'j1', snippet: 'first snippet', title: 'First Title', type: 'text', date: '2026-07-01', score: 0.9 },
        { journalId: 'j2', snippet: 'second snippet', title: 'Second Title', type: 'voice', date: '2026-07-02', score: 0.8 },
      ].map(async (s, i) => ({
        journalId: s.journalId,
        snippet: await encryptField(key, s.snippet, AAD.messagesSourceSnippet(i)),
        title: await encryptField(key, s.title, AAD.messagesSourceTitle(i)),
        type: s.type,
        date: s.date,
        score: s.score,
      })),
    )

    const data = {
      role: 'assistant',
      text: await encryptField(key, 'Here is what I found', AAD.messagesText),
      createdAt: Timestamp.now(),
      sources,
    }

    const msg = await decodeMessage('msg-3', data, key)
    expect(msg).not.toBeNull()
    expect(msg!.sources).toHaveLength(2)
    expect(msg!.sources![0]).toEqual({
      journalId: 'j1',
      snippet: 'first snippet',
      title: 'First Title',
      type: 'text',
      date: '2026-07-01',
      score: 0.9,
    })
    expect(msg!.sources![1]).toEqual({
      journalId: 'j2',
      snippet: 'second snippet',
      title: 'Second Title',
      type: 'voice',
      date: '2026-07-02',
      score: 0.8,
    })
  })

  it('drops just the corrupt source (keeping the message + other sources) when one source snippet fails to decrypt', async () => {
    const goodSource = {
      journalId: 'j1',
      snippet: await encryptField(key, 'good snippet', AAD.messagesSourceSnippet(0)),
      title: await encryptField(key, 'Good Title', AAD.messagesSourceTitle(0)),
      type: 'text',
      date: '2026-07-01',
      score: 0.9,
    }
    // Encrypted with the WRONG index AAD, so openField at index 1 will fail to authenticate.
    const badSource = {
      journalId: 'j2',
      snippet: await encryptField(key, 'bad snippet', AAD.messagesSourceSnippet(99)),
      title: await encryptField(key, 'Bad Title', AAD.messagesSourceTitle(99)),
      type: 'text',
      date: '2026-07-02',
      score: 0.5,
    }

    const data = {
      role: 'assistant',
      text: await encryptField(key, 'reply', AAD.messagesText),
      createdAt: Timestamp.now(),
      sources: [goodSource, badSource],
    }

    const msg = await decodeMessage('msg-4', data, key)
    expect(msg).not.toBeNull()
    expect(msg!.sources).toHaveLength(1)
    expect(msg!.sources![0].journalId).toBe('j1')
  })
})

// --- chats repo ---

const mocks = vi.hoisted(() => ({
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDocs: vi.fn(),
  writeBatchDelete: vi.fn(),
  writeBatchCommit: vi.fn(),
  dek: null as CryptoKey | null,
}))

vi.mock('@/lib/firebase', () => ({
  auth: {
    get currentUser() {
      return { uid: 'user-abc' }
    },
  },
  db: { __db: true },
}))

vi.mock('@/lib/crypto/dek', () => ({
  getCachedDEK: () => mocks.dek,
  bootstrapDEK: async () => mocks.dek,
}))

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>()
  return {
    ...actual,
    doc: vi.fn((_db: unknown, ...path: string[]) => ({ __ref: path.join('/') })),
    collection: vi.fn((_db: unknown, ...path: string[]) => ({ __collection: path.join('/') })),
    query: vi.fn((...args: unknown[]) => ({ __query: args })),
    where: vi.fn(),
    orderBy: vi.fn(),
    onSnapshot: vi.fn(),
    getDocs: (...args: unknown[]) => mocks.getDocs(...args),
    setDoc: (...args: unknown[]) => mocks.setDoc(...args),
    updateDoc: (...args: unknown[]) => mocks.updateDoc(...args),
    deleteDoc: (...args: unknown[]) => mocks.deleteDoc(...args),
    writeBatch: vi.fn(() => ({
      delete: (...args: unknown[]) => mocks.writeBatchDelete(...args),
      commit: (...args: unknown[]) => mocks.writeBatchCommit(...args),
    })),
  }
})

import { createChat, deleteChat, updateChatTitle } from '@/lib/firestore/chats'

beforeAll(async () => {
  mocks.dek = key
})

beforeEach(() => {
  mocks.setDoc.mockReset()
  mocks.updateDoc.mockReset()
  mocks.deleteDoc.mockReset()
  mocks.getDocs.mockReset()
  mocks.writeBatchDelete.mockReset()
  mocks.writeBatchCommit.mockReset()
})

describe('createChat', () => {
  it('setDoc-s an encrypted-title chat doc with a uuid id and the given kind', async () => {
    const id = await createChat({ kind: 'text', title: 'Hi' })

    expect(mocks.setDoc).toHaveBeenCalledTimes(1)
    const [ref, map] = mocks.setDoc.mock.calls[0]
    expect((ref as { __ref: string }).__ref).toBe(`chats/${id}`)
    expect(map.userId).toBe('user-abc')
    expect(map.kind).toBe('text')
    expect(isEncryptedField(map.title)).toBe(true)
    expect('journalId' in map).toBe(false)
    expect('journalTitle' in map).toBe(false)
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('defaults kind to "text" and title to "New chat" when omitted', async () => {
    await createChat()
    const [, map] = mocks.setDoc.mock.calls[0]
    expect(map.kind).toBe('text')
    const decoded = await decodeChat('x', map, key)
    expect(decoded.title).toBe('New chat')
  })

  it('includes journalId/journalTitle only when passed', async () => {
    await createChat({ journalId: 'j-1', journalTitle: 'My Journal' })
    const [, map] = mocks.setDoc.mock.calls[0]
    expect(map.journalId).toBe('j-1')
    expect(map.journalTitle).toBe('My Journal')
  })
})

describe('updateChatTitle', () => {
  it('updateDoc-s just the encrypted title field', async () => {
    await updateChatTitle('chat-1', 'Renamed')
    expect(mocks.updateDoc).toHaveBeenCalledTimes(1)
    const [ref, patch] = mocks.updateDoc.mock.calls[0]
    expect((ref as { __ref: string }).__ref).toBe('chats/chat-1')
    expect(isEncryptedField(patch.title)).toBe(true)
  })
})

describe('deleteChat', () => {
  it('deletes a small batch of messages in one pass then deletes the chat doc', async () => {
    mocks.getDocs.mockResolvedValueOnce({
      empty: false,
      docs: [{ ref: { __ref: 'm1' } }, { ref: { __ref: 'm2' } }],
    })

    await deleteChat('chat-1')

    // 2 docs fit in a single ≤400 chunk, so the whole subcollection is
    // cleared in one getDocs/batch pass — no second (empty) query needed.
    expect(mocks.getDocs).toHaveBeenCalledTimes(1)
    expect(mocks.writeBatchDelete).toHaveBeenCalledTimes(2)
    expect(mocks.writeBatchCommit).toHaveBeenCalledTimes(1)
    expect(mocks.deleteDoc).toHaveBeenCalledTimes(1)
    const [ref] = mocks.deleteDoc.mock.calls[0]
    expect((ref as { __ref: string }).__ref).toBe('chats/chat-1')
  })

  it('loops across multiple ≤400 batches when the subcollection is larger than one chunk', async () => {
    // The query itself is capped at `limit(DELETE_BATCH_SIZE)` (FIX D), so a
    // single getDocs call can never return more than 400 docs — a
    // full 400-doc page means there may be more, so deleteChat must delete
    // that page, then re-query and delete the 1 leftover from a second page.
    const firstPage = Array.from({ length: 400 }, (_, i) => ({ ref: { __ref: `m${i}` } }))
    const secondPage = [{ ref: { __ref: 'm400' } }]
    mocks.getDocs
      .mockResolvedValueOnce({ empty: false, docs: firstPage })
      .mockResolvedValueOnce({ empty: false, docs: secondPage })

    await deleteChat('chat-big')

    expect(mocks.getDocs).toHaveBeenCalledTimes(2)
    expect(mocks.writeBatchDelete).toHaveBeenCalledTimes(401)
    expect(mocks.writeBatchCommit).toHaveBeenCalledTimes(2)
    expect(mocks.deleteDoc).toHaveBeenCalledTimes(1)
  })

  it('deletes the chat doc directly when there are no messages', async () => {
    mocks.getDocs.mockResolvedValueOnce({ empty: true, docs: [] })

    await deleteChat('chat-2')

    expect(mocks.writeBatchDelete).not.toHaveBeenCalled()
    expect(mocks.deleteDoc).toHaveBeenCalledTimes(1)
  })
})
