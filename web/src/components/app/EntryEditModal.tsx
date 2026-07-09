'use client'

// Text-only entry edit sheet (parity with iOS `EntryEditView` /
// `EntryEditViewModel`). Edits title + canonical content; media, assets, and
// entry type are immutable. On save it applies the exact iOS side-effects:
//   • `applyEntryEdit` with `contentEditedAt` set ONLY when content changed
//     (so a title-only edit does not flag the summary stale),
//   • credit the signed word-count delta to the daily goal on the entry's
//     ORIGINAL day (best-effort) when content changed,
//   • fire-and-forget re-index when content changed (the server re-purges
//     chunks and, because contentEditedAt now post-dates the summary,
//     regenerates the summary + its embedding).
// A no-op edit (nothing changed) just closes without a write.

import { useEffect, useState } from 'react'
import { Loader2, Lock, X } from 'lucide-react'
import { applyEntryEdit, requestIndex } from '@/lib/firestore/journals'
import { recordEntrySaved } from '@/lib/firestore/profile'
import { planEntryEdit } from '@/lib/firestore/entryEdit'
import type { JournalEntry } from '@/lib/firestore/models'

const CONTENT_LABEL: Record<JournalEntry['type'], string> = {
  text: 'Entry',
  voice: 'Transcript',
  video: 'Transcript',
  image: 'Entry',
}

export default function EntryEditModal({
  entry,
  onClose,
}: {
  entry: JournalEntry
  onClose: () => void
}) {
  const [title, setTitle] = useState(entry.title)
  const [content, setContent] = useState(entry.content)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasMedia = (entry.media?.length ?? 0) > 0

  // Escape closes (unless a save is in flight).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const handleSave = async () => {
    if (saving) return
    const plan = planEntryEdit(entry.title, entry.content, title, content)
    if (!plan.hasChanges) {
      onClose()
      return
    }

    setSaving(true)
    setError(null)
    const now = new Date()
    try {
      await applyEntryEdit(
        entry.id,
        plan.newTitle,
        plan.newContent,
        plan.changedFields,
        plan.contentChanged ? now : undefined,
      )
      if (plan.contentChanged) {
        // Credit the word delta to the daily goal on the entry's ORIGINAL day
        // (best-effort, like the creation-side effect). Never blocks the save.
        if (plan.wordCountDelta !== 0) {
          try {
            await recordEntrySaved(plan.wordCountDelta, entry.createdAt)
          } catch (err) {
            console.error('[entry-edit] word-delta credit failed:', err)
          }
        }
        void requestIndex(entry.id)
      }
      onClose()
    } catch (err) {
      console.error('[entry-edit] save failed:', err)
      setError('We couldn’t save your changes. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-4 sm:items-center"
      style={{ background: 'color-mix(in srgb, var(--bg) 55%, transparent)', backdropFilter: 'blur(3px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Edit entry"
      onMouseDown={(e) => {
        // Backdrop click closes (guard against clicks that started inside).
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <div
        className="my-auto flex w-full max-w-[640px] flex-col gap-4 rounded-3xl p-5 sm:p-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadowHover)' }}
      >
        <header className="flex items-center justify-between">
          <h2 className="serif text-xl font-semibold" style={{ color: 'var(--text)' }}>
            Edit Entry
          </h2>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            aria-label="Cancel"
            className="flex h-8 w-8 items-center justify-center rounded-full transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{ color: 'var(--text2)' }}
            disabled={saving}
          >
            <X size={20} strokeWidth={1.75} />
          </button>
        </header>

        <label className="flex flex-col gap-1.5">
          <span className="font-sans text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
            Title
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="serif w-full rounded-xl px-3 py-2 text-[17px] outline-none placeholder:not-italic placeholder:text-[var(--text3)]"
            style={{ background: 'var(--bg)', border: '1px solid var(--hairline)', color: 'var(--text)' }}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-sans text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
            {CONTENT_LABEL[entry.type]}
          </span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write what’s on your mind…"
            className="serif w-full resize-none rounded-xl px-3 py-2.5 text-[17px] leading-[1.7] outline-none placeholder:not-italic placeholder:text-[var(--text3)]"
            style={{ background: 'var(--bg)', border: '1px solid var(--hairline)', color: 'var(--text)', minHeight: '38vh' }}
          />
        </label>

        {hasMedia && (
          <p className="flex items-center gap-1.5 font-sans text-xs" style={{ color: 'var(--text3)' }}>
            <Lock size={13} strokeWidth={1.75} />
            Photos, audio, and video can’t be changed after creation.
          </p>
        )}

        {error && (
          <p className="font-sans text-sm" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => !saving && onClose()}
            disabled={saving}
            className="rounded-full px-4 py-2 font-sans text-sm font-semibold transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{ color: 'var(--text2)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-full px-5 py-2 font-sans text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {saving && <Loader2 size={14} className="animate-spin" strokeWidth={2.25} />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
