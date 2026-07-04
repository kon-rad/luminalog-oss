'use client'

// Journal Detail (design B.9) — read one entry + its AI. M2 builds the
// TEXT-relevant behavior in full (body, AI Summary/Insights/Prompts once the
// server produces them, exclude-from-share); Related and Chat are later
// milestones (placeholders below).
//
// Live-decodes the doc via a single-doc `onSnapshot` (so an async summary/
// insights/prompts write from the server appears without a refresh) rather
// than a one-shot `getEntry`. The DEK may not be cached yet on the very first
// tick (e.g. deep-linking straight to a detail page before the session
// bootstrap's `bootstrapDEK()` resolves) — we keep the latest raw snapshot in
// a ref and ALSO kick off `bootstrapDEK()` ourselves; whichever of the two
// (the snapshot tick or the DEK becoming available) finishes last triggers
// the actual decode, so we never get stuck waiting on a snapshot event that
// won't re-fire just because our local key cache changed.

import { useEffect, useMemo, useRef, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { ArrowRight, ChevronDown, Ellipsis, Loader2 } from 'lucide-react'
import { auth, db } from '@/lib/firebase'
import { bootstrapDEK, getCachedDEK } from '@/lib/crypto/dek'
import { decodeEntry } from '@/lib/firestore/codec'
import { setExcludeFromShare } from '@/lib/firestore/journals'
import TypePill from '@/components/app/TypePill'
import { Skeleton } from '@/components/app/Skeleton'
import EmptyState from '@/components/app/EmptyState'
import type { JournalEntry } from '@/lib/firestore/models'

type DetailStatus = 'loading' | 'ready' | 'notFound' | 'decryptFailed'
type DetailTab = 'main' | 'insights' | 'prompts' | 'related'

const TABS: { key: DetailTab; label: string }[] = [
  { key: 'main', label: 'Main' },
  { key: 'insights', label: 'Insights' },
  { key: 'prompts', label: 'Prompts' },
  { key: 'related', label: 'Related' },
]

export default function JournalDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [status, setStatus] = useState<DetailStatus>('loading')
  const [tab, setTab] = useState<DetailTab>('main')

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setEntry(null)
    setTab('main')

    // The most recent raw doc payload — decoded as soon as a DEK is
    // available, whether that happens inside the snapshot callback or once
    // the `bootstrapDEK()` call below resolves.
    const latestRaw = { current: null as Record<string, unknown> | null }

    const decodeLatest = async (dek: CryptoKey) => {
      if (cancelled || !latestRaw.current) return
      try {
        const decoded = await decodeEntry(id, latestRaw.current, dek)
        if (cancelled) return
        if (decoded === null) setStatus('decryptFailed')
        else if (decoded.userId !== auth.currentUser?.uid) {
          // Cheap defense-in-depth: this doc decrypted fine (so it's a
          // legitimate envelope for someone's DEK) but doesn't belong to the
          // signed-in user. Security rules + fail-closed decoding already
          // protect against cross-tenant reads — this is just an explicit
          // client-side assertion, treated the same as decrypt-fail/not-found.
          console.error('[journal-detail] owner mismatch: entry.userId does not match current user')
          setStatus('decryptFailed')
        } else {
          setEntry(decoded)
          setStatus('ready')
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[journal-detail] decode failed:', err)
          setStatus('decryptFailed')
        }
      }
    }

    const unsubscribe = onSnapshot(
      doc(db, 'journals', id),
      (snap) => {
        if (cancelled) return
        if (!snap.exists()) {
          setStatus('notFound')
          return
        }
        latestRaw.current = snap.data()
        const dek = getCachedDEK()
        if (dek) void decodeLatest(dek)
        // else: the `bootstrapDEK()` call below resolves independently and
        // will call `decodeLatest` once a key is available.
      },
      (err) => {
        if (!cancelled) {
          console.error('[journal-detail] snapshot error:', err)
          setStatus('decryptFailed')
        }
      },
    )

    bootstrapDEK()
      .then((dek) => decodeLatest(dek))
      .catch((err) => {
        if (!cancelled) {
          console.error('[journal-detail] bootstrapDEK failed:', err)
          setStatus((prev) => (prev === 'loading' ? 'decryptFailed' : prev))
        }
      })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [id])

  if (status === 'notFound') {
    return <EmptyState title="Entry not found" message="This entry may have been deleted." />
  }
  if (status === 'decryptFailed') {
    return (
      <EmptyState
        title="This entry couldn't be opened."
        message="We weren't able to decrypt it on this device."
      />
    )
  }
  if (status === 'loading' || !entry) {
    return <DetailSkeleton />
  }

  return <DetailLoaded entry={entry} tab={tab} onTabChange={setTab} />
}

function DetailLoaded({
  entry,
  tab,
  onTabChange,
}: {
  entry: JournalEntry
  tab: DetailTab
  onTabChange: (tab: DetailTab) => void
}) {
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [excludeOverride, setExcludeOverride] = useState<boolean | null>(null)
  const exclude = excludeOverride ?? entry.excludeFromShare

  // Reset the optimistic override whenever we land on a fresh decode of a
  // (possibly different) entry so a stale override can't shadow real data.
  const entryId = entry.id
  useEffect(() => {
    setExcludeOverride(null)
  }, [entryId])

  // Also clear the override as soon as an incoming snapshot confirms it (the
  // value changed via this override OR elsewhere, e.g. another device) — an
  // override that only ever resets on entry-id change would otherwise shadow
  // a real, server-confirmed value indefinitely once set.
  const entryExcludeFromShare = entry.excludeFromShare
  useEffect(() => {
    if (excludeOverride !== null && entryExcludeFromShare === excludeOverride) {
      setExcludeOverride(null)
    }
  }, [entryExcludeFromShare, excludeOverride])

  const handleToggleExclude = async () => {
    const next = !exclude
    setExcludeOverride(next)
    try {
      await setExcludeFromShare(entry.id, next)
    } catch (err) {
      console.error('[journal-detail] setExcludeFromShare failed:', err)
      setExcludeOverride(!next)
    }
  }

  const analyzing = entry.vector.status !== 'indexed'
  const createdLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(entry.createdAt),
    [entry.createdAt],
  )

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="serif text-[26px] font-semibold leading-tight" style={{ color: 'var(--text)' }}>
            {entry.title || 'Untitled'}
          </h1>
          <button
            type="button"
            disabled
            title="Chat — coming soon"
            className="flex shrink-0 cursor-not-allowed items-center gap-0.5 rounded-full px-3 py-1.5 font-sans text-sm font-medium opacity-40"
            style={{ color: 'var(--text2)', border: '1px solid var(--hairline)' }}
          >
            Chat <ArrowRight size={14} strokeWidth={2} />
          </button>
        </div>
        <p className="font-sans text-sm" style={{ color: 'var(--text2)' }}>
          created {createdLabel} · {entry.wordCount} {entry.wordCount === 1 ? 'word' : 'words'}
        </p>

        <div className="flex items-center justify-between">
          <TypePill type={entry.type} />
          <div className="relative">
            <button
              type="button"
              onClick={() => setOptionsOpen((o) => !o)}
              aria-label="Entry options"
              className="flex h-8 w-8 items-center justify-center rounded-full transition-opacity hover:opacity-70"
              style={{ color: 'var(--text2)' }}
            >
              <Ellipsis size={20} strokeWidth={1.75} />
            </button>
            {optionsOpen && (
              <div
                className="absolute right-0 top-9 z-10 w-56 rounded-2xl p-4"
                style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadowHover)' }}
              >
                <p className="font-sans text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
                  Details
                </p>
                <dl className="mt-2 flex flex-col gap-1.5 font-sans text-[13px]" style={{ color: 'var(--text2)' }}>
                  <div className="flex justify-between gap-3">
                    <dt>Created</dt>
                    <dd style={{ color: 'var(--text)' }}>{createdLabel}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Words</dt>
                    <dd style={{ color: 'var(--text)' }}>{entry.wordCount}</dd>
                  </div>
                  {entry.editHistory && entry.editHistory.length > 0 && (
                    <div className="flex justify-between gap-3">
                      <dt>Edits</dt>
                      <dd style={{ color: 'var(--text)' }}>{entry.editHistory.length}</dd>
                    </div>
                  )}
                </dl>
                <p className="mt-3 font-sans text-[11px]" style={{ color: 'var(--text3)' }}>
                  Editing &amp; delete are coming soon.
                </p>
              </div>
            )}
          </div>
        </div>
      </header>

      {analyzing && (
        <div
          className="flex items-center gap-2 rounded-2xl px-4 py-2.5"
          style={{ background: 'var(--accentSoft)', color: 'var(--accentDeep)' }}
        >
          <Loader2 size={14} className="animate-spin" strokeWidth={2.25} />
          <span className="font-sans text-xs font-medium">Analyzing your entry…</span>
        </div>
      )}

      <nav className="flex gap-5 border-b" style={{ borderColor: 'var(--hairline)' }}>
        {TABS.map(({ key, label }) => {
          const active = tab === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onTabChange(key)}
              className="relative pb-2.5 font-sans text-sm font-semibold transition-colors"
              style={{ color: active ? 'var(--accent)' : 'var(--text2)' }}
            >
              {label}
              {active && (
                <span
                  className="absolute inset-x-0 -bottom-px h-[2px] rounded-full"
                  style={{ background: 'var(--accent)' }}
                />
              )}
            </button>
          )
        })}
      </nav>

      {tab === 'main' && <MainTab entry={entry} analyzing={analyzing} exclude={exclude} onToggleExclude={handleToggleExclude} />}
      {tab === 'insights' && <InsightsTab entry={entry} analyzing={analyzing} />}
      {tab === 'prompts' && <PromptsTab entry={entry} analyzing={analyzing} />}
      {tab === 'related' && <RelatedTab />}
    </div>
  )
}

function MainTab({
  entry,
  analyzing,
  exclude,
  onToggleExclude,
}: {
  entry: JournalEntry
  analyzing: boolean
  exclude: boolean
  onToggleExclude: () => void
}) {
  const [summaryOpen, setSummaryOpen] = useState(true)
  const summaryText = entry.summary?.text
  const showSummaryCard = Boolean(summaryText) || analyzing

  return (
    <div className="flex flex-col gap-6">
      {showSummaryCard && (
        <div className="card p-4">
          <button
            type="button"
            onClick={() => setSummaryOpen((o) => !o)}
            className="flex w-full items-center justify-between"
          >
            <span className="font-sans text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
              AI Summary
            </span>
            <ChevronDown
              size={16}
              strokeWidth={2}
              style={{ color: 'var(--text2)', transform: summaryOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }}
            />
          </button>
          {summaryOpen && (
            <p className="serif mt-3 whitespace-pre-wrap text-[15px] leading-relaxed" style={{ color: 'var(--text)' }}>
              {summaryText ?? 'Analyzing your entry…'}
            </p>
          )}
        </div>
      )}

      <p className="serif whitespace-pre-wrap text-[17px] leading-[1.8]" style={{ color: 'var(--text)' }}>
        {entry.content}
      </p>

      <label className="flex cursor-pointer items-center justify-between gap-4 border-t pt-4" style={{ borderColor: 'var(--hairline)' }}>
        <span className="font-sans text-sm" style={{ color: 'var(--text)' }}>
          Exclude from shareable insights
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={exclude}
          onClick={onToggleExclude}
          className="relative h-6 w-10 shrink-0 rounded-full transition-colors"
          style={{ background: exclude ? 'var(--accent)' : 'var(--hairline2)' }}
        >
          <span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
            style={{ transform: exclude ? 'translateX(18px)' : 'translateX(2px)' }}
          />
        </button>
      </label>
    </div>
  )
}

function InsightsTab({ entry, analyzing }: { entry: JournalEntry; analyzing: boolean }) {
  const insightsText = entry.insights?.text
  if (insightsText) {
    return (
      <p className="serif whitespace-pre-wrap text-[16px] leading-relaxed" style={{ color: 'var(--text)' }}>
        {insightsText}
      </p>
    )
  }
  if (analyzing) {
    return (
      <p className="font-sans text-sm" style={{ color: 'var(--text2)' }}>
        Analyzing your entry…
      </p>
    )
  }
  return <EmptyState title="No insights yet" message="Insights appear here once your entry has been analyzed." />
}

function PromptsTab({ entry, analyzing }: { entry: JournalEntry; analyzing: boolean }) {
  const items = entry.prompts?.items.slice(0, 5) ?? []
  if (items.length > 0) {
    return (
      <div className="flex flex-col gap-3">
        {items.map((prompt, i) => (
          <a
            key={i}
            href={`/create?prompt=${encodeURIComponent(prompt)}`}
            className="card flex items-center justify-between gap-3 p-4"
          >
            <p className="serif text-[15px] italic leading-snug" style={{ color: 'var(--text)' }}>
              &ldquo;{prompt}&rdquo;
            </p>
            <ArrowRight size={16} strokeWidth={2} style={{ color: 'var(--accent)' }} className="shrink-0" />
          </a>
        ))}
      </div>
    )
  }
  if (analyzing) {
    return (
      <p className="font-sans text-sm" style={{ color: 'var(--text2)' }}>
        Writing prompts…
      </p>
    )
  }
  return <EmptyState title="No prompts yet" message="Follow-up prompts appear here once your entry has been analyzed." />
}

function RelatedTab() {
  return (
    <EmptyState
      title="No related entries yet"
      message="Write a few more entries to discover connections."
    />
  )
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  )
}
