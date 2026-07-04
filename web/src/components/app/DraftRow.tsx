'use client'

import Link from 'next/link'
import Card from '@/components/app/Card'
import { formatEntryDateTime, truncatePreview } from '@/components/app/entryFormat'
import type { DraftEntry } from '@/lib/drafts/draftStore'

interface DraftRowProps {
  draft: DraftEntry
  className?: string
}

/** First non-blank line of the draft body, used as a stand-in title (the
 * seeded prompt wins when present — mirrors `deriveEntryTitle`). */
function draftHeadline(draft: DraftEntry): string {
  if (draft.promptText?.trim()) return draft.promptText.trim()
  const firstLine = draft.text.split('\n').find((line) => line.trim().length > 0)
  return firstLine?.trim() || 'Untitled draft'
}

/**
 * The local, unsaved-draft counterpart to `EntryRow` (design §9 / B.7 "Recent
 * entries" interleaves saved entries with draft rows): date/time, a
 * stand-in serif title, a short preview, and a "Draft" affordance in place of
 * the type pill. Always resumes into `/create?draft={draftId}`.
 * Presentational only — no data fetching.
 */
export default function DraftRow({ draft, className }: DraftRowProps) {
  const preview = truncatePreview(draft.text)

  return (
    <Link href={`/create?draft=${draft.draftId}`} className="block">
      <Card className={`flex items-start justify-between gap-3 ${className ?? ''}`}>
        <div className="min-w-0 flex-1">
          <p className="font-sans text-xs font-medium" style={{ color: 'var(--text2)' }}>
            {formatEntryDateTime(new Date(draft.updatedAtEpoch * 1000))}
          </p>
          <p className="serif mt-0.5 truncate text-[17px] font-semibold" style={{ color: 'var(--text)' }}>
            {draftHeadline(draft)}
          </p>
          {preview && (
            <p className="mt-1 line-clamp-2 text-sm" style={{ color: 'var(--text2)' }}>
              {preview}
            </p>
          )}
        </div>
        <span
          className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 font-sans text-[10px] font-semibold"
          style={{ background: 'var(--accentSoft)', color: 'var(--accentDeep)' }}
        >
          Draft
        </span>
      </Card>
    </Link>
  )
}
