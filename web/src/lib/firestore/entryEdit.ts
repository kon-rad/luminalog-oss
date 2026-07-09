// Pure edit-decision logic for a text entry edit (title + content), mirroring
// iOS `EntryEditViewModel.save()`: the title is trimmed before comparison, the
// content preserves intentional internal whitespace, `changedFields` is ordered
// title-before-content, and the word-count delta is only meaningful when the
// content changed (it drives the daily-goal credit + re-index side-effects).

import { wordCount } from '@/lib/wordCount'

export interface EntryEditPlan {
  /** Trimmed title to persist. */
  newTitle: string
  /** Content to persist, verbatim (internal whitespace preserved). */
  newContent: string
  /** Subset of `['title', 'content']`, in that order. */
  changedFields: string[]
  hasChanges: boolean
  contentChanged: boolean
  /** `wordCount(new) - wordCount(old)` when content changed, else 0. */
  wordCountDelta: number
}

export function planEntryEdit(
  oldTitle: string,
  oldContent: string,
  rawTitle: string,
  rawContent: string,
): EntryEditPlan {
  const newTitle = rawTitle.trim()
  const newContent = rawContent // preserve intentional internal whitespace

  const changedFields: string[] = []
  if (newTitle !== oldTitle) changedFields.push('title')
  if (newContent !== oldContent) changedFields.push('content')

  const contentChanged = changedFields.includes('content')
  const wordCountDelta = contentChanged ? wordCount(newContent) - wordCount(oldContent) : 0

  return {
    newTitle,
    newContent,
    changedFields,
    hasChanges: changedFields.length > 0,
    contentChanged,
    wordCountDelta,
  }
}
