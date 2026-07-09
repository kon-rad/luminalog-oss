import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { isEncryptedField } from '@/lib/crypto/envelope'

// Shared spies for the mocked Firestore/api surface.
const mocks = vi.hoisted(() => ({
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDoc: vi.fn(),
  apiPost: vi.fn(),
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

vi.mock('@/lib/api/client', () => ({
  apiPost: (...args: unknown[]) => mocks.apiPost(...args),
}))

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>()
  return {
    ...actual,
    doc: vi.fn((_db: unknown, ...path: string[]) => ({ __ref: path.join('/') })),
    collection: vi.fn((_db: unknown, path: string) => ({ __collection: path })),
    query: vi.fn((...args: unknown[]) => ({ __query: args })),
    where: vi.fn(),
    orderBy: vi.fn(),
    onSnapshot: vi.fn(),
    getDoc: (...args: unknown[]) => mocks.getDoc(...args),
    setDoc: (...args: unknown[]) => mocks.setDoc(...args),
    updateDoc: (...args: unknown[]) => mocks.updateDoc(...args),
    deleteDoc: (...args: unknown[]) => mocks.deleteDoc(...args),
    serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
    arrayUnion: vi.fn((v: unknown) => ({ __arrayUnion: v })),
  }
})

import { applyEntryEdit, createTextEntry, deleteEntry, requestIndex } from '@/lib/firestore/journals'
import { Timestamp } from 'firebase/firestore'

let key: CryptoKey

beforeAll(async () => {
  key = await crypto.subtle.importKey('raw', new Uint8Array(32), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ])
  mocks.dek = key
})

beforeEach(() => {
  mocks.setDoc.mockReset()
  mocks.updateDoc.mockReset()
  mocks.deleteDoc.mockReset()
  mocks.getDoc.mockReset()
  mocks.apiPost.mockReset()
  // Default: the doc doesn't exist yet, so `createTextEntry` takes the
  // `setDoc` create path (matches today's behavior unless a test overrides).
  mocks.getDoc.mockResolvedValue({ exists: () => false })
})

describe('createTextEntry', () => {
  it('setDoc-s the exact text create map (encrypted title/content, pending vector, wordCount, excludeFromShare)', async () => {
    const id = await createTextEntry({ title: 'My Title', content: 'four little words here' })

    expect(mocks.setDoc).toHaveBeenCalledTimes(1)
    const [ref, map] = mocks.setDoc.mock.calls[0]
    expect((ref as { __ref: string }).__ref).toBe(`journals/${id}`)

    expect(map.type).toBe('text')
    expect(map.userId).toBe('user-abc')
    expect(isEncryptedField(map.title)).toBe(true)
    expect(isEncryptedField(map.content)).toBe(true)
    expect(map.vector).toEqual({ status: 'pending', chunkCount: 0 })
    expect(map.wordCount).toBe(4)
    expect(map.excludeFromShare).toBe(false)
    expect(map.media).toEqual([])
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('uses the caller-supplied id instead of generating one', async () => {
    const id = await createTextEntry({ title: 't', content: 'c' }, 'draft-123')

    expect(id).toBe('draft-123')
    const [ref] = mocks.setDoc.mock.calls[0]
    expect((ref as { __ref: string }).__ref).toBe('journals/draft-123')
  })

  it('degrades to a targeted updateDoc (not setDoc) when the doc already exists, so server-owned fields are not clobbered', async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => true })

    const id = await createTextEntry({ title: 'Updated Title', content: 'updated content here' }, 'existing-doc')

    expect(id).toBe('existing-doc')
    expect(mocks.setDoc).not.toHaveBeenCalled()
    expect(mocks.updateDoc).toHaveBeenCalledTimes(1)

    const [ref, patch] = mocks.updateDoc.mock.calls[0]
    expect((ref as { __ref: string }).__ref).toBe('journals/existing-doc')
    expect(isEncryptedField(patch.title)).toBe(true)
    expect(isEncryptedField(patch.content)).toBe(true)
    expect(patch.wordCount).toBe(3)
    expect(patch.updatedAt).toEqual({ __serverTimestamp: true })
    // Server-owned fields (vector/summary/insights/prompts) must be absent —
    // this is a targeted patch, not a full-map overwrite.
    expect(patch.vector).toBeUndefined()
    expect(patch.summary).toBeUndefined()
    expect(patch.insights).toBeUndefined()
    expect(patch.prompts).toBeUndefined()
  })
})

describe('requestIndex', () => {
  it('swallows a rejected apiPost and never throws', async () => {
    mocks.apiPost.mockRejectedValue(new Error('network down'))

    await expect(requestIndex('journal-1')).resolves.toBeUndefined()
    expect(mocks.apiPost).toHaveBeenCalledWith('/api/rag/index', { journalId: 'journal-1' })
  })
})

describe('applyEntryEdit', () => {
  it('updateDoc-s encrypted title+content, wordCount, an arrayUnion editHistory record, and sets contentEditedAt when content changed', async () => {
    const editedAt = new Date('2026-07-10T12:00:00.000Z')

    await applyEntryEdit('journal-1', 'New Title', 'a longer new body here', ['title', 'content'], editedAt)

    expect(mocks.updateDoc).toHaveBeenCalledTimes(1)
    const [ref, patch] = mocks.updateDoc.mock.calls[0]
    expect((ref as { __ref: string }).__ref).toBe('journals/journal-1')
    expect(isEncryptedField(patch.title)).toBe(true)
    expect(isEncryptedField(patch.content)).toBe(true)
    expect(patch.wordCount).toBe(5)
    expect(patch.updatedAt).toEqual({ __serverTimestamp: true })
    // editHistory is appended, not overwritten.
    expect(patch.editHistory).toMatchObject({ __arrayUnion: { fields: ['title', 'content'] } })
    // Content changed → contentEditedAt is stamped so the summary is flagged stale.
    expect(patch.contentEditedAt).toBeInstanceOf(Timestamp)
    expect((patch.contentEditedAt as Timestamp).toMillis()).toBe(editedAt.getTime())
  })

  it('omits contentEditedAt for a title-only edit (undefined contentEditedAt) so the summary is NOT flagged stale', async () => {
    await applyEntryEdit('journal-1', 'Just A New Title', 'unchanged body', ['title'], undefined)

    const [, patch] = mocks.updateDoc.mock.calls[0]
    expect(isEncryptedField(patch.title)).toBe(true)
    expect(patch.editHistory).toMatchObject({ __arrayUnion: { fields: ['title'] } })
    expect('contentEditedAt' in patch).toBe(false)
  })
})

describe('deleteEntry', () => {
  it('calls deleteDoc for the given id', async () => {
    await deleteEntry('journal-1')

    expect(mocks.deleteDoc).toHaveBeenCalledTimes(1)
    const [ref] = mocks.deleteDoc.mock.calls[0]
    expect((ref as { __ref: string }).__ref).toBe('journals/journal-1')
  })
})
