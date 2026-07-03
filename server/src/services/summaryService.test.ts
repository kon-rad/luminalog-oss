import { vi, describe, it, expect, beforeEach } from 'vitest'

const updateMock = vi.fn(async () => {})
const userGet = vi.fn(async () => ({ data: () => ({ summaryConfig: { tone: 'plain' } }) }))

vi.mock('../middleware/firebaseAuth', () => ({
  db: {
    collection: (name: string) => ({
      doc: () => ({
        get: name === 'users' ? userGet : vi.fn(),
        update: updateMock,
      }),
    }),
  },
}))
vi.mock('../services/summaryGenerator', () => ({
  generateEntryAI: vi.fn(async () => ({
    summary: 'a summary',
    insights: '## Theme\n- point',
    prompts: ['q1?', 'q2?', 'q3?', 'q4?', 'q5?'],
    model: 'm',
    generatedAt: '2026-06-20T00:00:00.000Z',
  })),
}))
vi.mock('../services/summaryIndexer', () => ({ indexSummary: vi.fn(async () => {}) }))
vi.mock('../crypto/fieldCipher', () => ({
  encryptField: vi.fn((_dek: Buffer, text: string) => ({ ct: text })),
}))

import { ensureEntryAIIndexed, shouldRegenerateSummary } from './summaryService'
import { generateEntryAI } from './summaryGenerator'
import { indexSummary } from './summaryIndexer'

const DEK = Buffer.alloc(32)

describe('ensureEntryAIIndexed', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('generates + persists summary, insights, prompts and indexes the vector when none exists', async () => {
    const indexed = await ensureEntryAIIndexed({
      uid: 'u', journalId: 'e1', data: {}, content: 'hello world',
      title: 'T', type: 'voice', date: '2026-06-20', dek: DEK,
    })
    expect(generateEntryAI).toHaveBeenCalledTimes(1)
    // Only the summary text is embedded into the vector store.
    expect(indexSummary).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u', entryId: 'e1', summaryText: 'a summary', type: 'voice' }),
    )
    // The single Firestore update writes all three AI fields together.
    expect(updateMock).toHaveBeenCalledTimes(1)
    const written: any = (updateMock as any).mock.calls[0][0]
    expect(written).toHaveProperty('summary.text')
    expect(written).toHaveProperty('insights.text')
    expect(written.prompts.items).toHaveLength(5)
    expect(indexed).toBe(true)
  })

  it('forces regeneration even when a fresh summary already exists', async () => {
    const fresh = { summary: { generatedAt: { toMillis: () => 1_000_000 } } }
    const indexed = await ensureEntryAIIndexed({
      uid: 'u', journalId: 'e1', data: fresh, content: 'new transcript',
      title: 'T', type: 'voice', date: '2026-06-20', dek: DEK, force: true,
    })
    expect(generateEntryAI).toHaveBeenCalledTimes(1)
    expect(indexSummary).toHaveBeenCalledTimes(1)
    expect(indexed).toBe(true)
  })

  it('skips regeneration when a fresh summary exists and not forced', async () => {
    const data = {
      summary: { generatedAt: { toMillis: () => 2_000_000 } },
      vector: { summaryIndexed: true },
    }
    const indexed = await ensureEntryAIIndexed({
      uid: 'u', journalId: 'e1', data, content: 'x',
      title: 'T', type: 'voice', date: '2026-06-20', dek: DEK,
    })
    expect(generateEntryAI).not.toHaveBeenCalled()
    expect(indexSummary).not.toHaveBeenCalled()
    expect(indexed).toBe(true) // reflects existing vector.summaryIndexed
  })
})

describe('shouldRegenerateSummary', () => {
  it('regenerates when no summary exists', () => {
    expect(shouldRegenerateSummary({}, undefined)).toBe(true)
  })
  it('regenerates when forced', () => {
    expect(shouldRegenerateSummary({ summary: { generatedAt: { toMillis: () => 5 } } }, true)).toBe(true)
  })
  it('regenerates when content edited after the summary', () => {
    const data = {
      summary: { generatedAt: { toMillis: () => 100 } },
      contentEditedAt: { toMillis: () => 200 },
    }
    expect(shouldRegenerateSummary(data, false)).toBe(true)
  })
  it('skips when a fresh summary exists', () => {
    const data = {
      summary: { generatedAt: { toMillis: () => 300 } },
      contentEditedAt: { toMillis: () => 100 },
    }
    expect(shouldRegenerateSummary(data, false)).toBe(false)
  })
})
