'use client'

// Home tab root (design B.7) — the daily landing screen: a time-aware
// greeting, the live Daily Prompt hero carousel (design M3-T3), the stats
// row, a placeholder "Daily Reflections" scroller, and the latest
// entries/drafts interleaved. Single vertical scroll inside the centered app
// column the T8 `AppShell` provides.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Flame, BookText, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react'
import { useSession } from '@/lib/session/session-context'
import { streamEntries } from '@/lib/firestore/journals'
import { listDrafts, type DraftEntry } from '@/lib/drafts/draftStore'
import { localDayKey } from '@/lib/stats/dailyGoalStreak'
import { fetchDailyPrompt, type DailyPrompt, type DailyPromptResponse } from '@/lib/api/ai'
import EntryRow from '@/components/app/EntryRow'
import DraftRow from '@/components/app/DraftRow'
import GoalProgressCard from '@/components/app/GoalProgressCard'
import StatCard from '@/components/app/StatCard'
import SoulCard from '@/components/app/SoulCard'
import EmptyState from '@/components/app/EmptyState'
import { SkeletonRow } from '@/components/app/Skeleton'
import type { JournalEntry } from '@/lib/firestore/models'

/** Recent entries + drafts feed is capped at 10 items (design B.7 §5). */
const RECENT_LIMIT = 10

/** Per-local-day cache key for the Daily Prompt carousel (design M3-T3). */
const DAILY_PROMPT_CACHE_KEY = 'll-daily-prompt'
/** Carousel shows at most 5 prompts (design B.7 §2 / M3-T3). */
const MAX_DAILY_PROMPTS = 5
/** Grace window to wait for `profile.timezone` before falling back to the
 * browser's timezone, so a slow (or failed) profile load never blocks the
 * Home prompt hero. */
const PROFILE_GRACE_MS = 1500

type DailyPromptCacheEntry = { dayKey: string; payload: DailyPromptResponse }

type PromptHeroStatus = 'loading' | 'ready' | 'fallback'

/** The hero card shell (design A.7 "Prompt card") — 24px radius, diagonal
 * amber gradient overlay, warm hairline + shadow. Shared by the loading,
 * ready-carousel, and fallback states so all three read as one component. */
function PromptHeroShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-card"
      style={{
        background: 'linear-gradient(135deg, rgba(206,127,68,0.20), rgba(206,127,68,0.04))',
        border: '1px solid var(--hairline)',
        boxShadow: 'var(--shadow)',
      }}
    >
      {children}
    </div>
  )
}

/** A life-area chip (design A.7 "Type pill" family) — a small accent-tinted
 * pill labeling which area of life a prompt draws from. */
function AreaChip({ area }: { area: string }) {
  return (
    <span
      className="inline-flex w-fit items-center rounded-full px-2.5 py-1 font-sans text-[10px] font-semibold uppercase tracking-wide"
      style={{ background: 'var(--accentTint)', color: 'var(--accentDeep)' }}
    >
      {area}
    </span>
  )
}

/** One page of the carousel: life-area chip + serif-italic curly-quoted
 * question + full-width "Start Journaling." CTA seeded with THIS card's
 * prompt text (design M3-T3 §2). */
function PromptCard({ prompt }: { prompt: DailyPrompt }) {
  return (
    <div className="flex w-full shrink-0 snap-center flex-col p-6">
      <AreaChip area={prompt.area} />
      <p className="serif mt-4 flex-1 text-xl italic leading-snug" style={{ color: 'var(--text)' }}>
        &ldquo;{prompt.text}&rdquo;
      </p>
      <Link href={`/create?prompt=${encodeURIComponent(prompt.text)}`} className="btn-amber-full mt-5">
        Start Journaling.
      </Link>
    </div>
  )
}

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

  // Daily Prompt hero carousel (design M3-T3): resolve up to 5 personalized
  // prompts, cached per local calendar day in `localStorage`. States:
  // 'loading' (calm placeholder) -> 'ready' (carousel) or 'fallback' (a
  // single static prompt so Home is NEVER blocked by the AI call failing).
  const [promptStatus, setPromptStatus] = useState<PromptHeroStatus>('loading')
  const [prompts, setPrompts] = useState<DailyPrompt[]>([])
  const [activePromptIndex, setActivePromptIndex] = useState(0)
  const promptTrackRef = useRef<HTMLDivElement>(null)
  // Guards the resolution (cache-read / fetch) to run at most once per
  // signed-in uid, even though the effect below re-runs as `profile` streams
  // in updates — otherwise every profile change would re-check the cache.
  const promptResolvedRef = useRef(false)

  // Reset the carousel state whenever the signed-in user changes.
  useEffect(() => {
    promptResolvedRef.current = false
    setPromptStatus('loading')
    setPrompts([])
    setActivePromptIndex(0)
  }, [uid])

  useEffect(() => {
    if (!uid || promptResolvedRef.current) return

    const resolve = async (timezone: string) => {
      if (promptResolvedRef.current) return
      promptResolvedRef.current = true

      // Scope the cache to this uid so a shared browser never serves one
      // user's personalized prompts to the next (the prompts are derived from
      // the signed-in user's own private entries).
      const cacheKey = `${DAILY_PROMPT_CACHE_KEY}:${uid}`

      let dayKey: string
      try {
        dayKey = localDayKey(new Date(), timezone)
      } catch (err) {
        console.error('[home] invalid timezone for daily prompt:', err)
        setPromptStatus('fallback')
        return
      }

      try {
        const cachedRaw = window.localStorage.getItem(cacheKey)
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as Partial<DailyPromptCacheEntry>
          if (cached.dayKey === dayKey && cached.payload?.prompts?.length) {
            setPrompts(cached.payload.prompts.slice(0, MAX_DAILY_PROMPTS))
            setPromptStatus('ready')
            return
          }
        }
      } catch (err) {
        console.error('[home] reading cached daily prompt failed:', err)
        // Fall through to a fresh fetch — a corrupt cache entry shouldn't block Home.
      }

      try {
        const result = await fetchDailyPrompt()
        if (!result.prompts?.length) {
          setPromptStatus('fallback')
          return
        }
        try {
          const entry: DailyPromptCacheEntry = { dayKey, payload: result }
          window.localStorage.setItem(cacheKey, JSON.stringify(entry))
        } catch (err) {
          console.error('[home] caching daily prompt failed:', err)
          // Non-fatal — the carousel still renders from `result` this session.
        }
        setPrompts(result.prompts.slice(0, MAX_DAILY_PROMPTS))
        setPromptStatus('ready')
      } catch (err) {
        console.error('[home] fetchDailyPrompt failed:', err)
        setPromptStatus('fallback')
      }
    }

    // Prefer the profile's timezone once it's loaded (session bootstrap
    // resolves it quickly); otherwise give it a brief grace window before
    // falling back to the browser's timezone, so a slow/failed profile load
    // never blocks the Home prompt hero.
    if (profile) {
      void resolve(profile.timezone)
      return
    }
    const timer = setTimeout(() => {
      void resolve(Intl.DateTimeFormat().resolvedOptions().timeZone)
    }, PROFILE_GRACE_MS)
    return () => clearTimeout(timer)
  }, [uid, profile])

  const scrollToPrompt = (index: number) => {
    const track = promptTrackRef.current
    if (!track || prompts.length === 0) return
    const clamped = Math.max(0, Math.min(index, prompts.length - 1))
    track.scrollTo({ left: clamped * track.clientWidth, behavior: 'smooth' })
    setActivePromptIndex(clamped)
  }

  const handlePromptTrackScroll = () => {
    const track = promptTrackRef.current
    if (!track || track.clientWidth === 0) return
    const index = Math.round(track.scrollLeft / track.clientWidth)
    setActivePromptIndex((prev) => (prev === index ? prev : index))
  }

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

      {/* Your Soul (design: soulbound-NFT constellation) — the top block on
          Home, mirroring the iOS Home screen: the live constellation, an
          expand affordance, and the wallet address + BaseScan link. */}
      <SoulCard />

      {/* Daily Prompt hero carousel (design M3-T3 / A.7 "Prompt card") —
          the emotional focal point. loading -> ready (carousel) | fallback. */}
      {promptStatus === 'ready' && prompts.length > 0 ? (
        <PromptHeroShell>
          <div
            ref={promptTrackRef}
            onScroll={handlePromptTrackScroll}
            className="flex snap-x snap-mandatory overflow-x-auto"
            style={{ scrollbarWidth: 'none' }}
          >
            {prompts.map((prompt, i) => (
              <PromptCard key={i} prompt={prompt} />
            ))}
          </div>
          {prompts.length > 1 && (
            <div className="flex items-center justify-center gap-2 pb-4">
              {prompts.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Show prompt ${i + 1} of ${prompts.length}`}
                  aria-current={i === activePromptIndex}
                  onClick={() => scrollToPrompt(i)}
                  className="h-2 rounded-full transition-all duration-200"
                  style={{
                    width: i === activePromptIndex ? '18px' : '8px',
                    background: i === activePromptIndex ? 'var(--accent)' : 'var(--hairline2)',
                  }}
                />
              ))}
            </div>
          )}
        </PromptHeroShell>
      ) : promptStatus === 'loading' ? (
        <PromptHeroShell>
          <div className="flex flex-col p-6">
            <span
              className="h-4 w-24 rounded-full"
              style={{ background: 'var(--hairline2)' }}
              aria-hidden
            />
            <p className="serif mt-4 text-xl italic leading-snug" style={{ color: 'var(--text3)' }}>
              Finding a prompt for you&hellip;
            </p>
          </div>
        </PromptHeroShell>
      ) : (
        /* fallback — a single static prompt so Home is never blocked. */
        <PromptHeroShell>
          <div className="flex flex-col p-6">
            <p className="serif text-xl italic leading-snug" style={{ color: 'var(--text)' }}>
              &ldquo;What&apos;s on your mind today?&rdquo;
            </p>
            <Link href="/create" className="btn-amber-full mt-5">
              Start Journaling.
            </Link>
          </div>
        </PromptHeroShell>
      )}

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
