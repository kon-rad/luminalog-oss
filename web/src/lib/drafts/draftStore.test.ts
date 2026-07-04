import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  deleteDraft,
  getDraft,
  isDraftEmpty,
  listDrafts,
  newDraftId,
  putDraft,
  saveOrPruneDraft,
  type DraftEntry,
} from '@/lib/drafts/draftStore'

function makeDraft(overrides: Partial<DraftEntry> = {}): DraftEntry {
  return {
    draftId: newDraftId(),
    text: 'hello world',
    createdAtEpoch: 1000,
    updatedAtEpoch: 1000,
    attachments: [],
    ...overrides,
  }
}

beforeEach(async () => {
  // Fresh store per test. The module keeps a lazy singleton DB connection
  // open for the whole test file, so we clear rows through the public API
  // rather than deleting the database out from under that open connection.
  const existing = await listDrafts()
  await Promise.all(existing.map((d) => deleteDraft(d.draftId)))
})

describe('draftStore', () => {
  it('put + get round-trip', async () => {
    const draft = makeDraft({ text: 'a round trip draft' })
    await putDraft(draft)
    const loaded = await getDraft(draft.draftId)
    expect(loaded).toEqual(draft)
  })

  it('get returns undefined for a missing draft', async () => {
    const loaded = await getDraft(newDraftId())
    expect(loaded).toBeUndefined()
  })

  it('list is sorted by updatedAtEpoch desc', async () => {
    const older = makeDraft({ updatedAtEpoch: 100 })
    const newest = makeDraft({ updatedAtEpoch: 300 })
    const middle = makeDraft({ updatedAtEpoch: 200 })

    // Insert out of order.
    await putDraft(older)
    await putDraft(newest)
    await putDraft(middle)

    const listed = await listDrafts()
    expect(listed.map((d) => d.draftId)).toEqual([
      newest.draftId,
      middle.draftId,
      older.draftId,
    ])
  })

  it('delete removes the draft', async () => {
    const draft = makeDraft()
    await putDraft(draft)
    await deleteDraft(draft.draftId)
    expect(await getDraft(draft.draftId)).toBeUndefined()
  })

  it('rejects an empty draftId', async () => {
    await expect(getDraft('')).rejects.toThrow()
    await expect(deleteDraft('')).rejects.toThrow()
    await expect(putDraft(makeDraft({ draftId: '' }))).rejects.toThrow()
  })

  describe('isDraftEmpty', () => {
    it('true for blank text and no attachments', () => {
      expect(isDraftEmpty(makeDraft({ text: '' }))).toBe(true)
    })

    it('true for whitespace-only text and no attachments', () => {
      expect(isDraftEmpty(makeDraft({ text: '   \n\t  ' }))).toBe(true)
    })

    it('false when text is present', () => {
      expect(isDraftEmpty(makeDraft({ text: 'not empty' }))).toBe(false)
    })

    it('false when attachments are present even with blank text', () => {
      expect(
        isDraftEmpty(
          makeDraft({
            text: '',
            attachments: [
              { id: 'a1', kind: 'photo', fileName: 'a.jpg', order: 0 },
            ],
          })
        )
      ).toBe(false)
    })
  })

  describe('saveOrPruneDraft', () => {
    it('deletes an existing draft that became empty', async () => {
      const draft = makeDraft({ text: 'will be cleared' })
      await putDraft(draft)

      await saveOrPruneDraft({ ...draft, text: '   ' })

      expect(await getDraft(draft.draftId)).toBeUndefined()
    })

    it('persists a non-empty draft', async () => {
      const draft = makeDraft({ text: 'keep me' })
      await saveOrPruneDraft(draft)
      expect(await getDraft(draft.draftId)).toEqual(draft)
    })
  })

  it('newDraftId returns distinct ids', () => {
    const ids = new Set([newDraftId(), newDraftId(), newDraftId()])
    expect(ids.size).toBe(3)
  })
})
