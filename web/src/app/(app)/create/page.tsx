'use client'

// Create Entry (text) — design B.6, module map `(app)/create/`. Full-screen
// create surface reached from the FAB, a seeded prompt, or "resume draft"
// (BottomNav already hides on `/create` — see T8's `isImmersive`). M2 is
// text-only: the media row below the editor is present for visual parity
// with B.6 but permanently disabled ("coming soon") — no capture is wired.
//
// Draft lifecycle (design §9): text is autosaved to IndexedDB on a 0.7s
// debounce, keyed by a `draftId` that is either the resumed `?draft=` id or a
// fresh `newDraftId()` assigned on first keystroke/explicit Save. On Save,
// the draft's `createdAtEpoch` (preserved across the whole draft lifetime)
// becomes the entry's `createdAt` — this is the "when the user started this
// entry" moment, not the Save-tap moment, matching the resume contract in
// §9 ("Preserve createdAtEpoch ... when resuming a draft").

import { Suspense, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AudioLines, Camera, Loader2, Mic, Video as VideoIcon, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  deleteDraft,
  getDraft,
  newDraftId,
  saveOrPruneDraft,
  type DraftEntry,
} from '@/lib/drafts/draftStore'
import { createTextEntry, requestIndex } from '@/lib/firestore/journals'
import { recordEntrySaved } from '@/lib/firestore/profile'
import { wordCount } from '@/lib/wordCount'
import { deriveEntryTitle } from '@/lib/entryTitle'

const AUTOSAVE_DEBOUNCE_MS = 700

const MEDIA_ACTIONS: { label: string; Icon: LucideIcon }[] = [
  { label: 'Record', Icon: Mic },
  { label: 'Photo', Icon: Camera },
  { label: 'Video', Icon: VideoIcon },
  { label: 'Dictate', Icon: AudioLines },
]

export default function CreatePage() {
  // `useSearchParams` requires a Suspense boundary (Next.js CSR-bailout
  // rule) even though this whole route is already client-rendered.
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <CreateEntryScreen />
    </Suspense>
  )
}

function CreateEntryScreen() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [text, setText] = useState('')
  const [promptText, setPromptText] = useState<string | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)

  // The entry/draft id, the draft's original `createdAtEpoch`, and the
  // pending autosave timer all need to survive re-renders without
  // themselves triggering one — refs, not state.
  const draftIdRef = useRef<string | null>(null)
  const createdAtEpochRef = useRef<number | null>(null)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Resolve `?draft=`/`?prompt=` once, on mount.
  useEffect(() => {
    let cancelled = false
    const draftParam = searchParams.get('draft')
    const promptParam = searchParams.get('prompt')

    const init = async () => {
      if (draftParam) {
        draftIdRef.current = draftParam
        try {
          const existing = await getDraft(draftParam)
          if (!cancelled && existing) {
            setText(existing.text)
            setPromptText(existing.promptText)
            createdAtEpochRef.current = existing.createdAtEpoch
          }
        } catch (err) {
          console.error('[create] failed to load draft:', err)
        }
      } else if (promptParam) {
        setPromptText(promptParam)
      }
    }

    void init()
    return () => {
      cancelled = true
    }
    // Resolve exactly once on mount — this screen doesn't react to the URL
    // changing under it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const persistDraft = async (currentText: string) => {
    const nowEpoch = Math.floor(Date.now() / 1000)
    if (!draftIdRef.current) draftIdRef.current = newDraftId()
    if (createdAtEpochRef.current === null) createdAtEpochRef.current = nowEpoch

    const draft: DraftEntry = {
      draftId: draftIdRef.current,
      text: currentText,
      promptText,
      createdAtEpoch: createdAtEpochRef.current,
      updatedAtEpoch: nowEpoch,
      attachments: [],
    }
    try {
      await saveOrPruneDraft(draft)
    } catch (err) {
      console.error('[create] autosave failed:', err)
    }
  }

  const handleTextChange = (value: string) => {
    setText(value)
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => {
      void persistDraft(value)
    }, AUTOSAVE_DEBOUNCE_MS)
  }

  const hasContent = text.trim().length > 0
  const words = wordCount(text)

  const handleSave = async () => {
    if (saving) return
    const content = text.trim()
    if (!content) return

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    setSaving(true)
    setError(null)

    const entryId = draftIdRef.current ?? newDraftId()
    const createdAt = createdAtEpochRef.current
      ? new Date(createdAtEpochRef.current * 1000)
      : new Date()
    const title = deriveEntryTitle(content, promptText)

    try {
      const id = await createTextEntry({ title, content, createdAt, promptText }, entryId)

      // Best-effort — the entry is already durable even if the stats
      // transaction fails.
      try {
        await recordEntrySaved(wordCount(content), createdAt)
      } catch (err) {
        console.error('[create] recordEntrySaved failed:', err)
      }

      try {
        await deleteDraft(entryId)
      } catch (err) {
        console.error('[create] deleteDraft after save failed:', err)
      }

      // Fire-and-forget: requestIndex swallows its own errors (design §10).
      void requestIndex(id)

      router.push('/home')
    } catch (err) {
      console.error('[create] save failed:', err)
      setError('Could not save your entry. Please try again.')
      setSaving(false)
    }
  }

  const handleClose = () => {
    if (!hasContent) {
      router.push('/home')
      return
    }
    setCloseConfirmOpen(true)
  }

  const handleKeepAsDraft = async () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    await persistDraft(text)
    router.push('/home')
  }

  const handleDiscard = async () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    if (draftIdRef.current) {
      try {
        await deleteDraft(draftIdRef.current)
      } catch (err) {
        console.error('[create] discard failed:', err)
      }
    }
    router.push('/home')
  }

  const handleKeepEditing = () => setCloseConfirmOpen(false)

  return (
    <div className="flex min-h-[calc(100vh-5.5rem)] flex-col">
      <header className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Cancel"
          className="flex h-9 w-9 items-center justify-center rounded-full transition-opacity hover:opacity-70"
          style={{ color: 'var(--text2)' }}
        >
          <X size={22} strokeWidth={1.75} />
        </button>
        <h1 className="serif text-lg font-semibold" style={{ color: 'var(--text)' }}>
          Journal Entry
        </h1>
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasContent || saving}
          className="btn-amber h-9 px-4 text-sm disabled:opacity-40"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
        </button>
      </header>

      {promptText && (
        <div
          className="mb-4 rounded-2xl p-4"
          style={{
            background: 'linear-gradient(135deg, rgba(206,127,68,0.16), rgba(206,127,68,0.03))',
            borderLeft: '3px solid var(--accent)',
          }}
        >
          <p className="serif text-[15px] italic leading-relaxed" style={{ color: 'var(--text)' }}>
            &ldquo;{promptText}&rdquo;
          </p>
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder="Write what's on your mind…"
        autoFocus
        // Not `disabled` while the `?draft=` resume is resolving: IndexedDB
        // reads are effectively instant, and disabling would make `autoFocus`
        // unreliable (a disabled field never gets focus) for no real benefit.
        className="serif w-full flex-1 resize-none bg-transparent text-[17px] leading-[1.7] outline-none placeholder:text-[var(--text3)] placeholder:not-italic"
        style={textareaStyle}
      />

      <p className="mt-2 font-sans text-xs font-medium" style={{ color: 'var(--text3)' }}>
        {words} {words === 1 ? 'word' : 'words'}
      </p>

      {error && (
        <p className="mt-3 text-center text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      <div
        className="mt-6 flex items-center justify-center gap-6 border-t pt-4"
        style={{ borderColor: 'var(--hairline)' }}
      >
        {MEDIA_ACTIONS.map(({ label, Icon }) => (
          <button
            key={label}
            type="button"
            disabled
            title="Coming soon"
            className="flex cursor-not-allowed flex-col items-center gap-1 opacity-40"
            style={{ color: 'var(--text2)' }}
          >
            <span
              className="flex h-11 w-11 items-center justify-center rounded-full"
              style={{ background: 'var(--surfaceAlt)' }}
            >
              <Icon size={20} strokeWidth={1.75} />
            </span>
            <span className="font-sans text-[11px] font-medium">{label}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-center font-sans text-[11px]" style={{ color: 'var(--text3)' }}>
        Voice, photo &amp; video capture are coming soon — text only for now.
      </p>

      {closeConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6 sm:items-center"
          onClick={handleKeepEditing}
        >
          <div
            className="w-full max-w-sm rounded-card p-5"
            style={{ background: 'var(--surface)', boxShadow: 'var(--shadowHover)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p
              className="serif mb-4 text-center text-lg font-semibold"
              style={{ color: 'var(--text)' }}
            >
              Keep this entry?
            </p>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => void handleKeepAsDraft()} className="btn-amber-full">
                Keep as Draft
              </button>
              <button
                type="button"
                onClick={() => void handleDiscard()}
                className="w-full rounded-btn py-3 font-sans text-sm font-semibold"
                style={{ color: 'var(--danger)', border: '1px solid var(--hairline2)' }}
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleKeepEditing}
                className="w-full py-2 font-sans text-sm font-medium"
                style={{ color: 'var(--text2)' }}
              >
                Keep Editing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const textareaStyle: CSSProperties = { color: 'var(--text)', minHeight: '38vh' }
