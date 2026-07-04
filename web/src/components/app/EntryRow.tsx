'use client'

import Link from 'next/link'
import Card from '@/components/app/Card'
import TypePill, { type TypePillStatus } from '@/components/app/TypePill'
import { formatEntryDateTime, truncatePreview } from '@/components/app/entryFormat'
import type { JournalEntry } from '@/lib/firestore/models'

interface EntryRowProps {
  entry: JournalEntry
  /** Defaults to `/journal/{entry.id}`. */
  href?: string
  onClick?: () => void
  className?: string
}

/** Derives the optional processing/failed badge from the entry's own settle
 * state — never surfaced once both the save pipeline and RAG indexing have
 * settled cleanly. */
function processingStatus(entry: JournalEntry): TypePillStatus | undefined {
  if (entry.processingStatus === 'failed' || entry.vector.status === 'failed') return 'failed'
  if (entry.processingStatus && entry.processingStatus !== 'ready') return 'processing'
  if (entry.vector.status === 'pending') return 'processing'
  return undefined
}

/**
 * One journal-entry row (design B.8/B.9 `EntryRow`): date/time, a serif
 * title, a short content preview, the type pill, and an optional
 * processing/failed badge. Presentational only (no data fetching) — links to
 * `/journal/{id}` unless the caller supplies `href`/`onClick`.
 */
export default function EntryRow({ entry, href, onClick, className }: EntryRowProps) {
  const preview = truncatePreview(entry.content)
  const status = processingStatus(entry)

  const body = (
    <Card className={`flex items-start justify-between gap-3 ${className ?? ''}`}>
      <div className="min-w-0 flex-1">
        <p className="font-sans text-xs font-medium" style={{ color: 'var(--text2)' }}>
          {formatEntryDateTime(entry.createdAt)}
        </p>
        <p className="serif mt-0.5 truncate text-[17px] font-semibold" style={{ color: 'var(--text)' }}>
          {entry.title || 'Untitled'}
        </p>
        {preview && (
          <p className="mt-1 line-clamp-2 text-sm" style={{ color: 'var(--text2)' }}>
            {preview}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <TypePill type={entry.type} />
        {status && <TypePill type={entry.type} status={status} />}
      </div>
    </Card>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full text-left">
        {body}
      </button>
    )
  }

  return (
    <Link href={href ?? `/journal/${entry.id}`} className="block">
      {body}
    </Link>
  )
}
