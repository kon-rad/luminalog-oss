'use client'

// Home tab root (design B.7) — the daily landing screen: a time-aware
// greeting, a placeholder prompt hero (real personalized prompts are a later
// milestone), the stats row, a placeholder "Daily Reflections" scroller, and
// the latest entries/drafts interleaved. Single vertical scroll inside the
// centered app column the T8 `AppShell` provides.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Flame, BookText, Sparkles } from 'lucide-react'
import { useSession } from '@/lib/session/session-context'
import { streamEntries } from '@/lib/firestore/journals'
import { listDrafts, type DraftEntry } from '@/lib/drafts/draftStore'
import { localDayKey } from '@/lib/stats/dailyGoalStreak'
import EntryRow from '@/components/app/EntryRow'
import DraftRow from '@/components/app/DraftRow'
import GoalProgressCard from '@/components/app/GoalProgressCard'
import StatCard from '@/components/app/StatCard'
import EmptyState from '@/components/app/EmptyState'
import { SkeletonRow } from '@/components/app/Skeleton'
import type { JournalEntry } from '@/lib/firestore/models'

/** Recent entries + drafts feed is capped at 10 items (design B.7 §5). */
const RECENT_LIMIT = 10

function timeOfDayGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

type FeedItem =
  | { kind: 'entry'; ts: number; entry: JournalEntry }
  | { kind: 'draft'; ts: number; draft: DraftEntry }

export default function HomePage() {
  const router = useRouter()
  const { uid, profile } = useSession()

  // `null` = still loading (skeleton); `[]` = loaded, empty.
  const [entries, setEntries] = useState<JournalEntry[] | null>(null)
  const [drafts, setDrafts] = useState<DraftEntry[] | null>(null)

  useEffect(() => {
    if (!uid) return
    setEntries(null)
    const unsubscribe = streamEntries(uid, setEntries, () => setEntries([]))
    return unsubscribe
  }, [uid])

  useEffect(() => {
    let cancelled = false
    listDrafts()
      .then((d) => {
        if (!cancelled) setDrafts(d)
      })
      .catch((err) => {
        console.error('[home] listDrafts failed:', err)
        if (!cancelled) setDrafts([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Merge saved entries + local drafts newest-first by their own timestamps
  // (drafts store `updatedAtEpoch` in SECONDS; entries carry a `createdAt`
  // `Date` — normalize both to epoch millis before sorting).
  const feed = useMemo<FeedItem[] | null>(() => {
    if (entries === null || drafts === null) return null
    const items: FeedItem[] = [
      ...entries.map((entry) => ({ kind: 'entry' as const, ts: entry.createdAt.getTime(), entry })),
      ...drafts.map((draft) => ({ kind: 'draft' as const, ts: draft.updatedAtEpoch * 1000, draft })),
    ]
    items.sort((a, b) => b.ts - a.ts)
    return items.slice(0, RECENT_LIMIT)
  }, [entries, drafts])

  const firstName = profile?.displayName.trim().split(/\s+/)[0] || 'there'

  // Only counts toward "today" if `goalDayDate` is the same local calendar
  // day (in the user's stored timezone) as right now — otherwise the
  // accumulator belongs to a previous day and today's count is zero.
  const goalDayWords = useMemo(() => {
    if (!profile) return 0
    const { goalDayDate, goalDayWords: words } = profile.stats
    if (!goalDayDate) return 0
    const tz = profile.timezone
    return localDayKey(goalDayDate, tz) === localDayKey(new Date(), tz) ? words : 0
  }, [profile])

  const feedLoading = feed === null

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="eyebrow">Luminalog</p>
        <h1
          className="serif mt-1 text-[28px] font-semibold leading-tight"
          style={{ color: 'var(--text)' }}
        >
          {timeOfDayGreeting()}, {firstName}
        </h1>
      </header>

      {/* Daily Prompt hero (design A.7 "Prompt card") — a static placeholder;
          real personalized prompts land in a later milestone. */}
      <div
        className="rounded-card p-6"
        style={{
          background: 'linear-gradient(135deg, rgba(206,127,68,0.20), rgba(206,127,68,0.04))',
          border: '1px solid var(--hairline)',
          boxShadow: 'var(--shadow)',
        }}
      >
        <p className="serif text-xl italic leading-snug" style={{ color: 'var(--text)' }}>
          &ldquo;What&apos;s on your mind today?&rdquo;
        </p>
        <Link href="/create" className="btn-amber-full mt-5">
          Start Journaling.
        </Link>
      </div>

      {/* Stats row (design B.7 §3): skeleton-redacted until `profile` loads. */}
      <section className="grid grid-cols-2 gap-3">
        <GoalProgressCard goalDayWords={goalDayWords} loading={!profile} className="col-span-2" />
        <StatCard
          icon={Flame}
          value={profile ? `${profile.stats.streakCount}-day` : ''}
          label="Streak"
          loading={!profile}
        />
        <StatCard
          icon={BookText}
          value={profile ? profile.stats.totalWords.toLocaleString() : ''}
          label="Total words"
          loading={!profile}
        />
      </section>

      {/* Daily Reflections (design B.7 §4) — placeholder scroller; report
          generation is a later milestone. */}
      <section>
        <h2 className="mb-3 font-sans text-[15px] font-semibold" style={{ color: 'var(--text)' }}>
          Daily Reflections
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-1">
          <div
            className="flex w-[136px] shrink-0 cursor-not-allowed flex-col items-center justify-center gap-2 rounded-card p-4 text-center opacity-60"
            style={{ background: 'var(--surfaceAlt)', border: '1px dashed var(--hairline2)' }}
            title="Coming soon"
          >
            <Sparkles size={22} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
            <span className="font-sans text-xs font-medium" style={{ color: 'var(--text2)' }}>
              Generate your daily report
            </span>
            <span className="font-sans text-[10px] uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
              Coming soon
            </span>
          </div>
        </div>
      </section>

      {/* Recent entries (design B.7 §5): latest 10 entries + local drafts,
          newest first. */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-sans text-[15px] font-semibold" style={{ color: 'var(--text)' }}>
            Recent entries
          </h2>
          {!feedLoading && feed.length > 0 && (
            <Link href="/journal" className="font-sans text-sm font-medium" style={{ color: 'var(--accent)' }}>
              Show more
            </Link>
          )}
        </div>

        {feedLoading && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        )}

        {!feedLoading && feed.length === 0 && (
          <EmptyState
            title="No entries yet"
            message="Your journal is waiting — write your first entry to get started."
            actionLabel="Write your first entry"
            onAction={() => router.push('/create')}
          />
        )}

        {!feedLoading && feed.length > 0 && (
          <div className="flex flex-col gap-3">
            {feed.map((item) =>
              item.kind === 'entry' ? (
                <EntryRow key={item.entry.id} entry={item.entry} />
              ) : (
                <DraftRow key={item.draft.draftId} draft={item.draft} />
              ),
            )}
          </div>
        )}
      </section>
    </div>
  )
}
