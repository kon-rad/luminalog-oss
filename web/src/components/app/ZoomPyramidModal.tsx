'use client'

// Zoom Pyramid (2026-09-03 design spec): a modal opened from the Journal
// toolbar's fourth icon: day-through-lifetime spatial navigation over the whole
// journal, using the same shared renderer package the per-entry Cognitive Map
// uses. Mirrors ConstellationModal's overlay/Escape/backdrop-close/role=dialog
// shell; unlike that modal, this one drives a push/pull bridge into a
// framework-free `mountZoomPyramid` instance rather than a React component, since
// the renderer package has no React wrapper for the pyramid (only for the
// per-entry map). See packages/cognitive-map/README.md's "push in, pull requests
// out" section.

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import {
  mountZoomPyramid, isCognitiveMap,
  type ZoomPyramidHandle, type PeriodType, type FocusInfo, type Beat, type CognitiveMap,
} from '@/lib/cognitive-map'
import { fetchPeriodPositions, generatePeriodNarrative, type PeriodNarrativeDayInput } from '@/lib/ai/periodPyramid'
import { ensureCognitiveMap } from '@/lib/ai/entryMap'
import { BeatInspector } from '@/components/app/CognitiveMapPanel'
import { useTheme } from '@/lib/theme'
import {
  dayIndexFor, weekIndexFromDayIndex, monthIndexFromDayIndex,
  quarterIndexFromDayIndex, yearIndexFromDayIndex, thursdayDayIndexFromDayIndex,
} from '@/lib/stats/periodIndex'
import type { JournalEntry } from '@/lib/firestore/models'

interface ZoomPyramidModalProps {
  open: boolean
  onClose: () => void
  /** The journal page's already-live entry stream; this modal reads from it
   *  rather than opening a second Firestore subscription, mirroring how
   *  InsightsModal receives `entries` as a prop from the same page. */
  entries: JournalEntry[] | null
}

function periodIndexMatches(day: number, periodType: PeriodType, target: number): boolean {
  switch (periodType) {
    case 'day': return day === target
    case 'week': return weekIndexFromDayIndex(day) === target
    case 'month': return monthIndexFromDayIndex(thursdayDayIndexFromDayIndex(day)) === target
    case 'quarter': return quarterIndexFromDayIndex(thursdayDayIndexFromDayIndex(day)) === target
    case 'year': return yearIndexFromDayIndex(thursdayDayIndexFromDayIndex(day)) === target
    case 'lifetime': return true
    default: return false
  }
}

/**
 * Every entry whose local day falls in `periodType`/`periodIndex`, grouped into
 * `PeriodNarrativeDayInput`s from whatever beats each entry already has extracted.
 * An entry with no map yet contributes nothing: "arrives when it arrives," not
 * "generate on demand here," which would make opening a coarse tier trigger dozens
 * of entry-map generations at once.
 */
function daysInPeriod(
  entries: JournalEntry[] | null, periodType: PeriodType, periodIndex: number,
): PeriodNarrativeDayInput[] {
  if (!entries) return []
  const byDay = new Map<number, PeriodNarrativeDayInput['beats']>()
  for (const entry of entries) {
    const beats = entry.cognitiveMap?.map.beats
    if (!beats || beats.length === 0) continue
    const day = dayIndexFor(entry.createdAt)
    if (!periodIndexMatches(day, periodType, periodIndex)) continue
    const inputs = beats.map((b) => ({ text: b.text, kind: b.kind, domain: b.domain, isSpine: b.isSpine }))
    byDay.set(day, [...(byDay.get(day) ?? []), ...inputs])
  }
  return Array.from(byDay.entries()).map(([dayIndex, beats]) => ({ dayIndex, beats }))
}

/**
 * The day's most recently created entry, generating its map on demand if it does
 * not have one yet (mirrors CognitiveMapPanel's own on-open generation). Multiple
 * entries on one day: documented simplification, position (Track 1) stores no
 * per-entry position for a multi-entry day.
 *
 * `ensureCognitiveMap` persists the generated map to Firestore but returns only
 * whether it succeeded, not the map itself, so a freshly generated map cannot be
 * shown from this same call: it renders empty until the live `entries` stream's
 * next snapshot carries it in.
 */
async function resolveEntryForDay(
  entries: JournalEntry[] | null, dayPeriodIndex: number,
): Promise<{ map: CognitiveMap; content: string } | null> {
  if (!entries) return null
  const sameDay = entries
    .filter((e) => dayIndexFor(e.createdAt) === dayPeriodIndex)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  const entry = sameDay[0]
  if (!entry) return null

  if (!entry.cognitiveMap?.map || !isCognitiveMap(entry.cognitiveMap.map)) {
    await ensureCognitiveMap(entry)
    return { map: { v: 1, beats: [], edges: [] }, content: entry.content }
  }
  return { map: entry.cognitiveMap.map, content: entry.content }
}

export default function ZoomPyramidModal({ open, onClose, entries }: ZoomPyramidModalProps) {
  const { resolvedMode } = useTheme()
  const hostRef = useRef<HTMLDivElement | null>(null)
  const handleRef = useRef<ZoomPyramidHandle | null>(null)
  const entriesRef = useRef(entries)
  entriesRef.current = entries

  const [focusInfo, setFocusInfo] = useState<FocusInfo | null>(null)
  const [selected, setSelected] = useState<{ beat: Beat; content: string } | null>(null)
  const currentEntry = useRef<{ map: CognitiveMap; content: string } | null>(null)
  const narrativeCache = useRef(new Map<string, string>())

  // Escape closes, mirroring ConstellationModal.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const host = hostRef.current
    if (!host) return

    const handle = mountZoomPyramid(host, {
      colorScheme: resolvedMode === 'dark' ? 'dark' : 'light',
      onFocusChange: setFocusInfo,
      onSelectBeat: (beatId) => {
        const current = currentEntry.current
        const beat = current?.map.beats.find((b) => b.id === beatId)
        if (beat && current) setSelected({ beat, content: current.content })
      },
      onNeedTierData: (periodType) => {
        fetchPeriodPositions(periodType)
          .then((points) => handle.setTierData(periodType, points))
          .catch((err) => console.error('[zoom-pyramid] fetchPeriodPositions failed:', err))
      },
      onNeedNarrative: (periodType, periodIndex) => {
        const cacheKey = `${periodType}:${periodIndex}`
        const cached = narrativeCache.current.get(cacheKey)
        if (cached) { handle.setNarrative(periodType, periodIndex, cached); return }

        const days = daysInPeriod(entriesRef.current, periodType, periodIndex)
        if (days.length === 0) return
        generatePeriodNarrative(periodType, periodIndex, days)
          .then((narrative) => {
            if (!narrative) return
            narrativeCache.current.set(cacheKey, narrative)
            handle.setNarrative(periodType, periodIndex, narrative)
          })
          .catch((err) => console.error('[zoom-pyramid] generatePeriodNarrative failed:', err))
      },
      onNeedEntry: (dayPeriodIndex) => {
        void resolveEntryForDay(entriesRef.current, dayPeriodIndex).then((resolved) => {
          if (!resolved) {
            handle.setEntryMap(dayPeriodIndex, { v: 1, beats: [], edges: [] })
            return
          }
          currentEntry.current = { map: resolved.map, content: resolved.content }
          handle.setEntryMap(dayPeriodIndex, resolved.map)
        })
      },
    })
    handleRef.current = handle

    return () => {
      handle.destroy()
      handleRef.current = null
    }
    // Re-mounts only on open/theme change, matching CognitiveMapView's own
    // colorScheme-only remount rule; `entries` is read live via `entriesRef`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resolvedMode])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Zoom"
        className="mx-auto flex h-full w-full max-w-3xl flex-col p-4 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
          <h2 className="serif text-lg font-semibold" style={{ color: 'var(--text)' }}>Zoom</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close zoom"
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ color: 'var(--text2)' }}
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl" style={{ background: 'var(--surfaceAlt)' }}>
          <div ref={hostRef} className="h-full w-full" />
          {selected && (
            <BeatInspector beat={selected.beat} content={selected.content} onClose={() => setSelected(null)} />
          )}
        </div>

        {focusInfo && (
          <div className="mt-3 shrink-0 rounded-2xl p-4" style={{ background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)' }}>
            <p className="mb-1 font-sans text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text2)' }}>
              {focusInfo.periodType}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: focusInfo.narrative ? 'var(--text)' : 'var(--text2)' }}>
              {focusInfo.narrative ?? "Still gathering this period's story..."}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
