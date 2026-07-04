'use client'

// Search modal (design B.8b) — a full-screen-ish overlay opened from the
// Journal toolbar's Search button. A search field + Keyword/Semantic
// segmented control; on submit calls the M3-T1 `searchKeyword`/
// `searchSemantic` client and renders result rows → `/journal/{id}` (closing
// the modal on navigate so the detail page isn't left with the modal behind
// it). Read-only — results are already server-decrypted plaintext.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Search, X } from 'lucide-react'
import { searchKeyword, searchSemantic, type SearchResult } from '@/lib/api/ai'
import TypePill from '@/components/app/TypePill'
import EmptyState from '@/components/app/EmptyState'
import { SkeletonRow } from '@/components/app/Skeleton'
import { formatEntryDateTime, truncatePreview } from '@/components/app/entryFormat'

type Mode = 'keyword' | 'semantic'

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'results'; items: SearchResult[] }
  | { status: 'error' }

const MAX_QUERY_LENGTH = 500

interface SearchModalProps {
  open: boolean
  onClose: () => void
}

/** Formats a `SearchResult.date` (a `'yyyy-MM-dd'` or ISO string) the same
 * way `EntryRow`/Related rows do, falling back to the raw string if it
 * doesn't parse as a valid date. */
function formatResultDate(date: string): string {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  return formatEntryDateTime(parsed)
}

export default function SearchModal({ open, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<Mode>('keyword')
  const [state, setState] = useState<SearchState>({ status: 'idle' })
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset to a clean idle state and focus the input each time the modal
  // opens — a stale query/result set from a previous open would be
  // confusing to land back on.
  useEffect(() => {
    if (!open) return
    setQuery('')
    setState({ status: 'idle' })
    // Focus after the panel has actually mounted.
    const id = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [open])

  // Escape closes — client-only listener, attached only while open.
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const trimmed = query.trim()
  const tooLong = trimmed.length > MAX_QUERY_LENGTH

  function runSearch(q: string, searchMode: Mode) {
    // `searchKeyword`/`searchSemantic` validate + throw *synchronously* on an
    // empty/oversize query (they are not async functions) — an
    // `await search(q).catch()` would NOT catch that throw, so the call
    // itself must be inside this `try`. We also pre-validate above so this
    // is defense-in-depth, not the primary guard.
    setState({ status: 'loading' })
    try {
      const promise = searchMode === 'keyword' ? searchKeyword(q) : searchSemantic(q)
      promise
        .then((res) => setState({ status: 'results', items: res.results }))
        .catch((err) => {
          console.error('[search-modal] search failed:', err)
          setState({ status: 'error' })
        })
    } catch (err) {
      console.error('[search-modal] search threw synchronously:', err)
      setState({ status: 'error' })
    }
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!trimmed || tooLong) return
    runSearch(trimmed, mode)
  }

  function handleModeChange(next: Mode) {
    setMode(next)
    // Clearing back to idle (rather than re-running) per design note — the
    // segmented control is a "pick your search kind, then submit" control.
    setState({ status: 'idle' })
  }

  function handleClose() {
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pb-6 pt-6 sm:pt-16"
      onClick={handleClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search your journal"
        className="flex max-h-full w-full max-w-lg flex-col rounded-card p-5"
        style={{ background: 'var(--surface)', boxShadow: 'var(--shadowHover)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="serif text-lg font-semibold" style={{ color: 'var(--text)' }}>
            Search
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close search"
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ color: 'var(--text2)' }}
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div
            className="flex items-center gap-2 rounded-btn px-3 py-2.5"
            style={{ background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)' }}
          >
            <Search size={16} strokeWidth={1.75} style={{ color: 'var(--text3)' }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your journal…"
              className="w-full flex-1 bg-transparent font-sans text-[15px] outline-none placeholder:text-[var(--text3)]"
              style={{ color: 'var(--text)' }}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div
              className="inline-flex gap-1 rounded-full p-1"
              style={{ background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)' }}
            >
              <SegmentButton label="Keyword" active={mode === 'keyword'} onClick={() => handleModeChange('keyword')} />
              <SegmentButton label="Semantic" active={mode === 'semantic'} onClick={() => handleModeChange('semantic')} />
            </div>
            <button
              type="submit"
              disabled={!trimmed || tooLong}
              className="btn-amber disabled:cursor-not-allowed disabled:opacity-40"
            >
              Search
            </button>
          </div>

          {tooLong && (
            <p className="font-sans text-xs" style={{ color: 'var(--danger)' }}>
              Search queries are limited to {MAX_QUERY_LENGTH} characters.
            </p>
          )}
        </form>

        <div className="mt-4 min-h-[120px] flex-1 overflow-y-auto">
          <SearchResults state={state} query={trimmed} onClose={handleClose} onRetry={() => runSearch(trimmed, mode)} />
        </div>
      </div>
    </div>
  )
}

function SegmentButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 font-sans text-[13px] font-semibold transition-colors ${
        active ? 'bg-accent text-white dark:bg-accentDk' : ''
      }`}
      style={active ? undefined : { color: 'var(--text2)' }}
    >
      {label}
    </button>
  )
}

function SearchResults({
  state,
  query,
  onClose,
  onRetry,
}: {
  state: SearchState
  query: string
  onClose: () => void
  onRetry: () => void
}) {
  if (state.status === 'idle') {
    return (
      <p className="px-1 py-8 text-center font-sans text-sm" style={{ color: 'var(--text2)' }}>
        Search your journal by keyword or meaning.
      </p>
    )
  }

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col gap-3">
        <p className="flex items-center gap-2 font-sans text-sm" style={{ color: 'var(--text2)' }}>
          <Loader2 size={14} className="animate-spin" strokeWidth={2.25} />
          Searching…
        </p>
        <SkeletonRow />
        <SkeletonRow />
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <EmptyState
        title="Search unavailable"
        message="Something went wrong. Please try again."
        actionLabel="Try again"
        onAction={onRetry}
      />
    )
  }

  if (state.items.length === 0) {
    return <EmptyState title="No results" message={query ? `Nothing matched "${query}."` : 'Nothing matched your search.'} />
  }

  return (
    <div className="flex flex-col gap-3">
      {state.items.map((result) => (
        <Link
          key={result.journalId}
          href={`/journal/${result.journalId}`}
          onClick={onClose}
          className="card flex flex-col gap-1.5 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="serif min-w-0 flex-1 truncate text-[15px] font-semibold" style={{ color: 'var(--text)' }}>
              {result.title || 'Untitled'}
            </p>
            <TypePill type={result.type} className="shrink-0" />
          </div>
          <p className="font-sans text-xs font-medium" style={{ color: 'var(--text2)' }}>
            {formatResultDate(result.date)}
          </p>
          {result.snippet && (
            <p className="line-clamp-2 font-sans text-sm" style={{ color: 'var(--text2)' }}>
              {truncatePreview(result.snippet)}
            </p>
          )}
        </Link>
      ))}
    </div>
  )
}
