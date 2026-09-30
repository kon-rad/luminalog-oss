import { vi, describe, it, expect, beforeEach } from 'vitest'

const col = {
  get: vi.fn(async () => ({ ids: [] as string[], metadatas: [] as any[] })),
  add: vi.fn(async () => {}),
  delete: vi.fn(async () => {}),
  query: vi.fn(async () => ({
    metadatas: [[{ entryId: 'e1', chunkIndex: 0 }, { entryId: 'e2', chunkIndex: 3 }]],
    distances: [[0.1, 0.4]],
  })),
}
const resetJournalsCollection = vi.fn()
vi.mock('../db/chroma', () => ({
  getJournalsCollection: async () => col,
  resetJournalsCollection: () => resetJournalsCollection(),
}))
vi.mock('./aiClient', () => ({ embed: vi.fn(async (t: string[]) => t.map(() => [0.1, 0.2, 0.3])) }))

import { indexEntryChunks, deleteEntryChunks, searchChunks, getEntryDays, CHUNKER_VERSION } from './ragStore'
import { embed } from './aiClient'

beforeEach(() => { vi.clearAllMocks() })

describe('indexEntryChunks', () => {
  it('purges old chunks, embeds, and adds one row per chunk with no text', async () => {
    const n = await indexEntryChunks({
      userId: 'u1', entryId: 'e1', type: 'text', dayIndex: 5, wordCount: 12,
      chunks: ['alpha', 'beta'],
    })
    expect(n).toBe(2)
    // delete-before-add (clean re-index)
    expect(col.delete).toHaveBeenCalledWith({
      where: { $and: [{ userId: { $eq: 'u1' } }, { entryId: { $eq: 'e1' } }] },
    })
    expect(embed).toHaveBeenCalledWith(['alpha', 'beta'])
    const addArg = (col.add as any).mock.calls[0][0]
    expect(addArg.ids).toEqual(['u1__e1__0', 'u1__e1__1'])
    expect(addArg.embeddings.length).toBe(2)
    expect(addArg.metadatas[1]).toEqual({
      userId: 'u1', entryId: 'e1', chunkIndex: 1, chunkerVersion: CHUNKER_VERSION,
      type: 'text', dayIndex: 5, wordCount: 12,
    })
    // NO document/text field anywhere in the payload
    expect(JSON.stringify(addArg)).not.toContain('alpha')
    expect(JSON.stringify(addArg)).not.toContain('beta')
  })

  it('self-heals a stale collection: resets the cache and retries once on NotFound', async () => {
    // First delete throws a Chroma NotFound (collection was wiped/recreated);
    // after resetJournalsCollection the retry succeeds.
    col.delete
      .mockRejectedValueOnce(Object.assign(new Error('The requested resource could not be found'), { name: 'ChromaNotFoundError' }))
      .mockResolvedValueOnce(undefined)
    const n = await indexEntryChunks({
      userId: 'u1', entryId: 'e1', type: 'text', dayIndex: 0, wordCount: 1, chunks: ['a'],
    })
    expect(n).toBe(1)
    expect(resetJournalsCollection).toHaveBeenCalledTimes(1)
    expect(col.add).toHaveBeenCalledTimes(1) // add still ran after the retry
  })

  it('deletes and adds nothing for an empty chunk list', async () => {
    const n = await indexEntryChunks({
      userId: 'u1', entryId: 'e1', type: 'text', dayIndex: 0, wordCount: 0, chunks: [],
    })
    expect(n).toBe(0)
    expect(col.delete).toHaveBeenCalledTimes(1)
    expect(col.add).not.toHaveBeenCalled()
    expect(embed).not.toHaveBeenCalled()
  })

  it('adds localDayIndex to every chunk when given', async () => {
    await indexEntryChunks({
      userId: 'u1', entryId: 'e1', type: 'text', dayIndex: 5, localDayIndex: 6, wordCount: 12,
      chunks: ['alpha', 'beta'],
    })
    const addArg = (col.add as any).mock.calls[0][0]
    expect(addArg.metadatas.map((m: any) => m.localDayIndex)).toEqual([6, 6])
    expect(addArg.metadatas[0].dayIndex).toBe(5) // the constellation's day is untouched
  })

  it('accepts a pending localDayIndex and awaits it only after embedding', async () => {
    let resolveDay!: (d: number) => void
    const pendingDay = new Promise<number>(r => { resolveDay = r })
    const done = indexEntryChunks({
      userId: 'u1', entryId: 'e1', type: 'text', dayIndex: 5, localDayIndex: pendingDay, wordCount: 12,
      chunks: ['alpha', 'beta'],
    })
    await new Promise(setImmediate)
    // Embedding ran while the local day was still unresolved; nothing written yet.
    expect(embed).toHaveBeenCalledWith(['alpha', 'beta'])
    expect(col.add).not.toHaveBeenCalled()
    resolveDay(7)
    expect(await done).toBe(2)
    const addArg = (col.add as any).mock.calls[0][0]
    expect(addArg.metadatas.map((m: any) => m.localDayIndex)).toEqual([7, 7])
  })
})

describe('getEntryDays', () => {
  it("returns both stored days in one userId-scoped metadata read", async () => {
    ;(col.get as any).mockResolvedValueOnce({ ids: ['u1__e9__0'], metadatas: [{ dayIndex: 20356, localDayIndex: 20357 }] })
    expect(await getEntryDays('u1', 'e9')).toEqual({ dayIndex: 20356, localDayIndex: 20357 })
    expect(col.get).toHaveBeenCalledTimes(1)
    expect(col.get).toHaveBeenCalledWith({
      where: { $and: [{ userId: { $eq: 'u1' } }, { entryId: { $eq: 'e9' } }] },
      include: ['metadatas'],
      limit: 1,
    })
  })

  it('returns a null localDayIndex for chunks indexed before the field existed', async () => {
    ;(col.get as any).mockResolvedValueOnce({ ids: ['u1__e9__0'], metadatas: [{ dayIndex: 5 }] })
    expect(await getEntryDays('u1', 'e9')).toEqual({ dayIndex: 5, localDayIndex: null })
  })

  it('returns both null when the entry has no chunks', async () => {
    ;(col.get as any).mockResolvedValueOnce({ ids: [], metadatas: [] })
    expect(await getEntryDays('u1', 'e9')).toEqual({ dayIndex: null, localDayIndex: null })
  })
})

describe('deleteEntryChunks', () => {
  it('deletes only the entry’s chunks, userId-scoped', async () => {
    await deleteEntryChunks('u1', 'e9')
    expect(col.delete).toHaveBeenCalledWith({
      where: { $and: [{ userId: { $eq: 'u1' } }, { entryId: { $eq: 'e9' } }] },
    })
  })
})

describe('searchChunks', () => {
  it('embeds the query, filters by userId, maps distance→similarity', async () => {
    const hits = await searchChunks('u1', 'how am i', 8)
    expect(embed).toHaveBeenCalledWith(['how am i'])
    const queryArg = (col.query as any).mock.calls[0][0]
    expect(queryArg.nResults).toBe(8)
    expect(queryArg.where).toEqual({ userId: { $eq: 'u1' } })
    expect(hits).toEqual([
      { entryId: 'e1', chunkIndex: 0, score: 0.9 },
      { entryId: 'e2', chunkIndex: 3, score: 0.6 },
    ])
  })
})
