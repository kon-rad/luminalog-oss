import { describe, it, expect } from 'vitest'
import { planEntryEdit } from '@/lib/firestore/entryEdit'

describe('planEntryEdit', () => {
  it('reports no changes when title and content are untouched', () => {
    const plan = planEntryEdit('A day', 'Body text here.', 'A day', 'Body text here.')
    expect(plan.hasChanges).toBe(false)
    expect(plan.changedFields).toEqual([])
    expect(plan.contentChanged).toBe(false)
    expect(plan.wordCountDelta).toBe(0)
  })

  it('trims the title before comparing, so leading/trailing whitespace is not a change', () => {
    const plan = planEntryEdit('A day', 'Body.', '  A day  ', 'Body.')
    expect(plan.hasChanges).toBe(false)
    expect(plan.newTitle).toBe('A day')
  })

  it('preserves intentional internal whitespace in content (no trim of content)', () => {
    const plan = planEntryEdit('t', 'one two', 't', '  one   two  ')
    expect(plan.contentChanged).toBe(true)
    expect(plan.newContent).toBe('  one   two  ')
  })

  it('flags a title-only edit: content unchanged, no word delta, contentChanged false', () => {
    const plan = planEntryEdit('Old', 'same body words', 'New Title', 'same body words')
    expect(plan.hasChanges).toBe(true)
    expect(plan.changedFields).toEqual(['title'])
    expect(plan.contentChanged).toBe(false)
    expect(plan.wordCountDelta).toBe(0)
  })

  it('flags a content-only edit and computes the signed word-count delta', () => {
    // old content = 2 words, new content = 4 words → delta +2
    const plan = planEntryEdit('t', 'two words', 't', 'now four words total')
    expect(plan.changedFields).toEqual(['content'])
    expect(plan.contentChanged).toBe(true)
    expect(plan.wordCountDelta).toBe(2)
  })

  it('reports a negative delta when content shrinks', () => {
    const plan = planEntryEdit('t', 'four words right here', 't', 'two words')
    expect(plan.wordCountDelta).toBe(-2)
  })

  it('orders changedFields title-before-content when both change', () => {
    const plan = planEntryEdit('Old', 'a b', 'New', 'a b c')
    expect(plan.changedFields).toEqual(['title', 'content'])
    expect(plan.contentChanged).toBe(true)
    expect(plan.wordCountDelta).toBe(1)
  })
})
