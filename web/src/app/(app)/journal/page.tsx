'use client'

// Journal tab root (design B.8) — browse all entries: a type-filter chip row,
// a date-sectioned ("Today" / "This Week" / "Month Year") live stream of
// `EntryRow`s, and a toolbar wiring Search, Constellation (M8-T2), and
// Insights (M8-T1) to their respective modals.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, Hexagon, Search } from 'lucide-react'
import { useSession } from '@/lib/session/session-context'
import { streamEntries } from '@/lib/firestore/journals'
import EntryRow from '@/components/app/EntryRow'
import EmptyState from '@/components/app/EmptyState'
import { SkeletonRow } from '@/components/app/Skeleton'
import SearchModal from '@/components/app/SearchModal'
import InsightsModal from '@/components/app/InsightsModal'
import ConstellationModal from '@/components/app/ConstellationModal'
import { localDayKey } from '@/lib/stats/dailyGoalStreak'
import type { JournalEntry, JournalType } from '@/lib/firestore/models'

type FilterKey = 'all' | JournalType | 'prompted'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'text', label: 'Text' },
  { key: 'voice', label: 'Voice' },
  { key: 'video', label: 'Video' },
  { key: 'image', label: 'Image' },
  { key: 'prompted', label: 'Prompted' },
]

// Per-type tint fills when a chip is selected (design A.2 journal-type
// tints); All/Prompted use the single brand accent.
const FILTER_SOLID: Record<FilterKey, string> = {
  all: 'bg-accent dark:bg-accentDk',
  text: 'bg-accent dark:bg-accentDk',
  voice: 'bg-typeVoice dark:bg-typeVoiceDk',
  video: 'bg-typeVideo dark:bg-typeVideoDk',
  image: 'bg-typeImage dark:bg-typeImageDk',
  prompted: 'bg-accent dark:bg-accentDk',
}

function matchesFilter(entry: JournalEntry, filter: FilterKey): boolean {
  if (filter === 'all') return true
  if (filter === 'prompted') return !!entry.promptText
  return entry.type === filter
}

/** `YYYY-MM-DD` day key → days-since-epoch (UTC, DST-safe) for date-diffing. */
function dayKeyToEpochDays(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

/** Section label per design B.8: "Today," "This Week," then "Month Year." */
function sectionLabel(date: Date, timezone: string, now: Date): string {
  const dateKey = localDayKey(date, timezone)
  const nowKey = localDayKey(now, timezone)
  if (dateKey === nowKey) return 'Today'
  const diffDays = dayKeyToEpochDays(nowKey) - dayKeyToEpochDays(dateKey)
  if (diffDays > 0 && diffDays < 7) return 'This Week'
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: timezone }).format(date)
}

export default function JournalPage() {
  const router = useRouter()
  const { uid, profile } = useSession()

  const [filter, setFilter] = useState<FilterKey>('all')
  // `null` = loading; array (possibly empty) once the first snapshot lands.
  const [entries, setEntries] = useState<JournalEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [insightsOpen, setInsightsOpen] = useState(false)
  const [constellationOpen, setConstellationOpen] = useState(false)

  useEffect(() => {
    if (!uid) return
    setEntries(null)
    setError(null)
    const unsubscribe = streamEntries(
      uid,
      setEntries,
      (err) => setError(err instanceof Error ? err.message : 'Something went wrong.'),
    )
    return unsubscribe
  }, [uid, retryKey])

  const filtered = useMemo(() => (entries ?? []).filter((e) => matchesFilter(e, filter)), [entries, filter])

  const sections = useMemo(() => {
    const timezone = profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
    const now = new Date()
    const map = new Map<string, JournalEntry[]>()
    for (const entry of filtered) {
      const label = sectionLabel(entry.createdAt, timezone, now)
      const bucket = map.get(label)
      if (bucket) bucket.push(entry)
      else map.set(label, [entry])
    }
    return Array.from(map.entries())
  }, [filtered, profile])

  const loading = entries === null && !error
  const loadError = error !== null
  const empty = !loading && !loadError && entries !== null && entries.length === 0
  const filteredEmpty = !loading && !loadError && !empty && filtered.length === 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="serif text-[26px] font-semibold" style={{ color: 'var(--text)' }}>
          Journal
        </h1>
        <div className="flex items-center gap-1">
          <ToolbarButton icon={Search} label="Search" onClick={() => setSearchOpen(true)} />
          <ToolbarButton icon={Hexagon} label="Constellation" onClick={() => setConstellationOpen(true)} />
          <ToolbarButton icon={BarChart3} label="Insights" onClick={() => setInsightsOpen(true)} />
        </div>
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <InsightsModal open={insightsOpen} onClose={() => setInsightsOpen(false)} entries={entries} />
      <ConstellationModal open={constellationOpen} onClose={() => setConstellationOpen(false)} />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map(({ key, label }) => {
          const active = filter === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 font-sans text-[13px] font-semibold transition-colors ${
                active ? `${FILTER_SOLID[key]} text-white` : ''
              }`}
              style={
                active
                  ? undefined
                  : { background: 'var(--surfaceAlt)', color: 'var(--text2)', border: '1px solid var(--hairline)' }
              }
            >
              {label}
            </button>
          )
        })}
      </div>

      {loading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      )}

      {loadError && (
        <EmptyState
          title="Couldn't load your journal"
          message={error ?? 'Please try again.'}
          actionLabel="Retry"
          onAction={() => setRetryKey((k) => k + 1)}
        />
      )}

      {empty && (
        <EmptyState
          title="No entries yet"
          message="Your journal is waiting — write your first entry to get started."
          actionLabel="Write your first entry"
          onAction={() => router.push('/create')}
        />
      )}

      {filteredEmpty && <EmptyState title="No matches" message="No entries match this filter yet." />}

      {!loading && !loadError && !empty && !filteredEmpty && (
        <div className="flex flex-col gap-6">
          {sections.map(([label, sectionEntries]) => (
            <section key={label}>
              <h2
                className="mb-3 font-sans text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--text2)' }}
              >
                {label}
              </h2>
              <div className="flex flex-col gap-3">
                {sectionEntries.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Search
  label: string
  /** Omit to render the disabled "coming soon" placeholder (Constellation/Insights). */
  onClick?: () => void
}) {
  if (!onClick) {
    return (
      <button
        type="button"
        disabled
        title={`${label} — coming soon`}
        aria-label={label}
        className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-full opacity-40"
        style={{ color: 'var(--text2)' }}
      >
        <Icon size={18} strokeWidth={1.75} />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
      style={{ color: 'var(--text2)' }}
    >
      <Icon size={18} strokeWidth={1.75} />
    </button>
  )
}
