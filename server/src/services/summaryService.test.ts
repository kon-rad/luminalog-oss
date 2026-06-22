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
  generateSummaryText: vi.fn(async () => ({
    text: 'a summary', model: 'm', generatedAt: '2026-06-20T00:00:00.000Z',
  })),
}))
vi.mock('../services/summaryIndexer', () => ({ indexSummary: vi.fn(async () => {}) }))
vi.mock('../crypto/fieldCipher', () => ({
  encryptField: vi.fn((_dek: Buffer, text: string) => ({ ct: text })),
}))

import { ensureEntrySummaryIndexed, shouldRegenerateSummary } from './summaryService'
import { generateSummaryText } from './summaryGenerator'
import { indexSummary } from './summaryIndexer'

const DEK = Buffer.alloc(32)

describe('ensureEntrySummaryIndexed', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('generates and indexes a summary vector when none exists', async () => {
    const indexed = await ensureEntrySummaryIndexed({
      uid: 'u', journalId: 'e1', data: {}, content: 'hello world',
      title: 'T', type: 'voice', date: '2026-06-20', dek: DEK,
    })
    expect(generateSummaryText).toHaveBeenCalledTimes(1)
    expect(indexSummary).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u', entryId: 'e1', summaryText: 'a summary', type: 'voice' }),
    )
    expect(updateMock).toHaveBeenCalled() // persists summary text to Firestore
    expect(indexed).toBe(true)
  })

  it('forces regeneration even when a fresh summary already exists', async () => {
    const fresh = { summary: { generatedAt: { toMillis: () => 1_000_000 } } }
    const indexed = await ensureEntrySummaryIndexed({
      uid: 'u', journalId: 'e1', data: fresh, content: 'new transcript',
      title: 'T', type: 'voice', date: '2026-06-20', dek: DEK, force: true,
    })
    expect(generateSummaryText).toHaveBeenCalledTimes(1)
    expect(indexSummary).toHaveBeenCalledTimes(1)
    expect(indexed).toBe(true)
  })

  it('skips regeneration when a fresh summary exists and not forced', async () => {
    const data = {
      summary: { generatedAt: { toMillis: () => 2_000_000 } },
      vector: { summaryIndexed: true },
    }
    const indexed = await ensureEntrySummaryIndexed({
      uid: 'u', journalId: 'e1', data, content: 'x',
      title: 'T', type: 'voice', date: '2026-06-20', dek: DEK,
    })
    expect(generateSummaryText).not.toHaveBeenCalled()
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
