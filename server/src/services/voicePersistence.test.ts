import { vi, describe, it, expect } from 'vitest'

vi.mock('../crypto/fieldCipher', () => ({
  encryptField: (_k: Buffer, p: string, ctx: string) => ({ enc: p, ctx }),
}))
vi.mock('firebase-admin', () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } },
}))

import { persistVoiceTurn } from './voicePersistence'

function mockDb() {
  const sets: any[] = []
  const updates: any[] = []
  const doc = (path: string): any => ({
    set: (data: any, opts: any) => { sets.push({ path, data, opts }); return Promise.resolve() },
    update: (data: any) => { updates.push({ path, data }); return Promise.resolve() },
    collection: (c: string) => ({ doc: (id: string) => doc(`${path}/${c}/${id}`) }),
  })
  const db: any = { collection: (c: string) => ({ doc: (id: string) => doc(`${c}/${id}`) }), __sets: sets, __updates: updates }
  return db
}

describe('persistVoiceTurn', () => {
  it('writes idempotent user + assistant docs with encrypted text and sources', async () => {
    const db = mockDb()
    await persistVoiceTurn(db, Buffer.alloc(32), {
      chatId: 'c1', turnIndex: 2, userText: 'hi there',
      assistantText: 'hello back',
      sources: [{ journalId: 'e1', type: 'note', date: '2026-06-01', score: 0.8, title: 'T', snippet: 'S' }],
    })
    const userDoc = db.__sets.find((s: any) => s.path.endsWith('live_2_user'))
    const asstDoc = db.__sets.find((s: any) => s.path.endsWith('live_2_assistant'))
    expect(userDoc.data.role).toBe('user')
    expect(userDoc.opts).toEqual({ merge: true })
    expect(asstDoc.data.role).toBe('assistant')
    expect(asstDoc.data.sources[0].journalId).toBe('e1')
    expect(asstDoc.data.sources[0].title).toEqual({ enc: 'T', ctx: 'messages.sources.0.title' })
    expect(asstDoc.data.sources[0].snippet).toEqual({ enc: 'S', ctx: 'messages.sources.0.snippet' })
  })

  it('skips empty user and assistant text', async () => {
    const db = mockDb()
    await persistVoiceTurn(db, Buffer.alloc(32), { chatId: 'c1', turnIndex: 0, userText: '', assistantText: '', sources: [] })
    expect(db.__sets).toHaveLength(0)
  })
})
