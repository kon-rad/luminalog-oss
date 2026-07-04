'use client'

// Insights dashboard (design B.13) — a modal opened from the Journal
// toolbar's Insights button. Everything is computed ON-DEVICE over the
// already-streamed, already-decrypted `entries` prop (the parent Journal page
// owns the one live `streamEntries` subscription — this modal does not
// double-subscribe). Mirrors `SearchModal`'s overlay/Escape/backdrop-close/
// `role=dialog` shell. Charts are plain SVG/HTML per the dataviz method — no
// chart library — with a validated categorical palette for the (self-hiding)
// emotional-trends card; see `insights.ts` for the pure data helpers.

import { useEffect, useMemo, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import Card from '@/components/app/Card'
import EmptyState from '@/components/app/EmptyState'
import { Skeleton } from '@/components/app/Skeleton'
import { useSession } from '@/lib/session/session-context'
import {
  activityByDay,
  emotionSeries,
  hasEmotionData,
  typeCounts,
  wordFrequencies,
  type ActivityDay,
  type EmotionDayBucket,
  type TypeCountEntry,
} from '@/components/app/insights'
import type { JournalEntry, JournalType } from '@/lib/firestore/models'

interface InsightsModalProps {
  open: boolean
  onClose: () => void
  /** `null` = still loading the entry stream; the parent owns the subscription. */
  entries: JournalEntry[] | null
}

export default function InsightsModal({ open, onClose, entries }: InsightsModalProps) {
  const { profile } = useSession()
  const timezone = profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone

  // Escape closes — client-only listener, attached only while open (mirrors SearchModal).
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const loading = entries === null
  const empty = entries !== null && entries.length === 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pb-6 pt-6 sm:pt-12"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Insights"
        className="flex max-h-full w-full max-w-2xl flex-col rounded-card p-5"
        style={{ background: 'var(--surface)', boxShadow: 'var(--shadowHover)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
          <h2 className="serif text-lg font-semibold" style={{ color: 'var(--text)' }}>
            Insights
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close insights"
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ color: 'var(--text2)' }}
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div className="min-h-[200px] flex-1 overflow-y-auto">
          {loading && <InsightsLoading />}
          {empty && (
            <EmptyState
              title="No insights yet"
              message="Write a few entries and your patterns will appear here."
            />
          )}
          {!loading && !empty && entries && <InsightsBody entries={entries} timezone={timezone} />}
        </div>
      </div>
    </div>
  )
}

function InsightsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 font-sans text-sm" style={{ color: 'var(--text2)' }}>
        <Loader2 size={14} className="animate-spin" strokeWidth={2.25} />
        Reading your journal…
      </p>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card flex flex-col gap-3 p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-28 w-full" />
        </div>
      ))}
    </div>
  )
}

function InsightsBody({ entries, timezone }: { entries: JournalEntry[]; timezone: string }) {
  const words = useMemo(() => wordFrequencies(entries.map((e) => e.content)), [entries])
  const activity = useMemo(() => activityByDay(entries, timezone), [entries, timezone])
  const types = useMemo(() => typeCounts(entries), [entries])
  const showEmotion = useMemo(() => hasEmotionData(entries), [entries])
  const emotion = useMemo(
    () => (showEmotion ? emotionSeries(entries, timezone) : { emotions: [], days: [] }),
    [entries, timezone, showEmotion],
  )

  return (
    <div className="flex flex-col gap-4">
      <WordCloudCard words={words} />
      {showEmotion && emotion.emotions.length > 0 && (
        <EmotionTrendsCard emotions={emotion.emotions} days={emotion.days} />
      )}
      <ActivityHeatmapCard days={activity} />
      {types.length > 1 && <TypeDonutCard types={types} />}
    </div>
  )
}

// --- Your words (word cloud) ---

const WORD_FONT_MIN = 12
const WORD_FONT_MAX = 36
const WORD_OPACITY_MIN = 0.4
const WORD_OPACITY_MAX = 1

function WordCloudCard({ words }: { words: { word: string; count: number }[] }) {
  const scaled = useMemo(() => {
    if (words.length === 0) return []
    const counts = words.map((w) => w.count)
    const max = Math.max(...counts)
    const min = Math.min(...counts)
    const range = max - min || 1
    return words.map((w) => {
      const t = (w.count - min) / range
      return {
        ...w,
        fontSize: WORD_FONT_MIN + t * (WORD_FONT_MAX - WORD_FONT_MIN),
        opacity: WORD_OPACITY_MIN + t * (WORD_OPACITY_MAX - WORD_OPACITY_MIN),
      }
    })
  }, [words])

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h3 className="serif text-base font-semibold" style={{ color: 'var(--text)' }}>
          Your words
        </h3>
        <p className="font-sans text-xs" style={{ color: 'var(--text2)' }}>
          The words that show up most across your journal.
        </p>
      </div>
      {scaled.length === 0 ? (
        <p className="py-6 text-center font-sans text-sm" style={{ color: 'var(--text2)' }}>
          No words yet.
        </p>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 py-2">
          {scaled.map(({ word, count, fontSize, opacity }) => (
            <span
              key={word}
              title={`${count} time${count === 1 ? '' : 's'}`}
              tabIndex={0}
              className="serif leading-none"
              style={{ fontSize, opacity, color: 'var(--accentDeep)' }}
            >
              {word}
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}

// --- Emotional trends (multi-line time series) ---
// Categorical palette validated with the dataviz script (see report): a
// FIXED 4-slot order (index -> slot), theme "spirit / art / intellect /
// emotion" from the brand dimension spectrum, with dark-mode steps re-picked
// (not auto-flipped) to clear the dark OKLCH lightness band. Arbitrary-hex
// Tailwind utilities keep both modes theme-aware without touching
// tailwind.config.js.
const EMOTION_STROKE_CLASSES = [
  'stroke-[#9B72CF] dark:stroke-[#986fcb]',
  'stroke-[#7DBF72] dark:stroke-[#58994e]',
  'stroke-[#4A7FD4] dark:stroke-[#4A7FD4]',
  'stroke-[#E8748A] dark:stroke-[#cd5c73]',
]
const EMOTION_FILL_CLASSES = [
  'fill-[#9B72CF] dark:fill-[#986fcb]',
  'fill-[#7DBF72] dark:fill-[#58994e]',
  'fill-[#4A7FD4] dark:fill-[#4A7FD4]',
  'fill-[#E8748A] dark:fill-[#cd5c73]',
]
const EMOTION_SWATCH_CLASSES = [
  'bg-[#9B72CF] dark:bg-[#986fcb]',
  'bg-[#7DBF72] dark:bg-[#58994e]',
  'bg-[#4A7FD4] dark:bg-[#4A7FD4]',
  'bg-[#E8748A] dark:bg-[#cd5c73]',
]

const CHART_W = 640
const CHART_H = 220
const PAD_LEFT = 34
const PAD_RIGHT = 10
const PAD_TOP = 12
const PAD_BOTTOM = 26
const PLOT_W = CHART_W - PAD_LEFT - PAD_RIGHT
const PLOT_H = CHART_H - PAD_TOP - PAD_BOTTOM

function formatShortDate(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    new Date(Date.UTC(y, m - 1, d, 12)),
  )
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1)
}

function EmotionTrendsCard({
  emotions,
  days,
}: {
  emotions: string[]
  days: EmotionDayBucket[]
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const maxVal = useMemo(() => {
    let m = 0
    for (const d of days) for (const v of Object.values(d.values)) m = Math.max(m, v)
    return m > 0 ? m * 1.15 : 1
  }, [days])

  const n = days.length
  const xFor = (i: number) => PAD_LEFT + (n <= 1 ? PLOT_W / 2 : (i / (n - 1)) * PLOT_W)
  const yFor = (v: number) => PAD_TOP + PLOT_H - (v / maxVal) * PLOT_H

  const segments = useMemo(
    () =>
      emotions.map((name) => {
        const runs: { x: number; y: number }[][] = []
        let current: { x: number; y: number }[] = []
        days.forEach((d, i) => {
          const v = d.values[name]
          if (v === undefined) {
            if (current.length) runs.push(current)
            current = []
            return
          }
          current.push({ x: xFor(i), y: yFor(v) })
        })
        if (current.length) runs.push(current)
        return { name, runs }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [emotions, days, maxVal],
  )

  const yTicks = [0, maxVal / 2, maxVal]
  const bandWidth = n > 0 ? PLOT_W / n : PLOT_W
  const hover = hoverIdx !== null ? days[hoverIdx] : undefined

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h3 className="serif text-base font-semibold" style={{ color: 'var(--text)' }}>
          Emotional trends
        </h3>
        <p className="font-sans text-xs" style={{ color: 'var(--text2)' }}>
          Your top emotions over time, by day.
        </p>
      </div>

      <div className="relative w-full" style={{ aspectRatio: `${CHART_W} / ${CHART_H}` }}>
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="h-full w-full" role="img" aria-label="Emotional trends over time">
          {yTicks.map((t, i) => (
            <g key={i}>
              <line
                x1={PAD_LEFT}
                x2={CHART_W - PAD_RIGHT}
                y1={yFor(t)}
                y2={yFor(t)}
                stroke="var(--hairline)"
                strokeWidth={1}
              />
              <text
                x={PAD_LEFT - 6}
                y={yFor(t)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={9}
                fill="var(--text3)"
              >
                {Math.round(t * 100)}%
              </text>
            </g>
          ))}

          {segments.map(({ name, runs }, si) =>
            runs.map((points, ri) => (
              <path
                key={`${name}-${ri}`}
                d={points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')}
                fill="none"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={EMOTION_STROKE_CLASSES[si % EMOTION_STROKE_CLASSES.length]}
              />
            )),
          )}

          {hoverIdx !== null && (
            <line
              x1={xFor(hoverIdx)}
              x2={xFor(hoverIdx)}
              y1={PAD_TOP}
              y2={PAD_TOP + PLOT_H}
              stroke="var(--hairline2)"
              strokeWidth={1}
            />
          )}
          {hoverIdx !== null &&
            emotions.map((name, si) => {
              const v = days[hoverIdx]?.values[name]
              if (v === undefined) return null
              return (
                <circle
                  key={name}
                  cx={xFor(hoverIdx)}
                  cy={yFor(v)}
                  r={4}
                  strokeWidth={2}
                  stroke="var(--surface)"
                  className={EMOTION_FILL_CLASSES[si % EMOTION_FILL_CLASSES.length]}
                />
              )
            })}

          {/* Hover hit-bands — one per day, discrete (no continuous mouse tracking
              needed): >=24px-equivalent hit target per the interaction rules. */}
          {days.map((d, i) => (
            <rect
              key={d.day}
              x={xFor(i) - bandWidth / 2}
              y={PAD_TOP}
              width={bandWidth}
              height={PLOT_H}
              fill="transparent"
              tabIndex={0}
              role="img"
              aria-label={`${formatShortDate(d.day)}: ${emotions
                .filter((name) => d.values[name] !== undefined)
                .map((name) => `${capitalize(name)} ${Math.round((d.values[name] ?? 0) * 100)}%`)
                .join(', ')}`}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              onFocus={() => setHoverIdx(i)}
              onBlur={() => setHoverIdx(null)}
            >
              <title>{formatShortDate(d.day)}</title>
            </rect>
          ))}

          {n > 0 && (
            <>
              <text x={xFor(0)} y={CHART_H - 6} textAnchor="start" fontSize={9} fill="var(--text3)">
                {formatShortDate(days[0].day)}
              </text>
              {n > 1 && (
                <text x={xFor(n - 1)} y={CHART_H - 6} textAnchor="end" fontSize={9} fill="var(--text3)">
                  {formatShortDate(days[n - 1].day)}
                </text>
              )}
            </>
          )}
        </svg>

        {hover && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg px-2.5 py-1.5 font-sans text-xs"
            style={{
              left: `${(xFor(hoverIdx as number) / CHART_W) * 100}%`,
              top: `${(PAD_TOP / CHART_H) * 100}%`,
              background: 'var(--text)',
              color: 'var(--bg)',
              boxShadow: 'var(--shadow)',
            }}
          >
            <p className="mb-0.5 font-semibold">{formatShortDate(hover.day)}</p>
            {emotions
              .filter((name) => hover.values[name] !== undefined)
              .map((name) => (
                <p key={name}>
                  {capitalize(name)} — {Math.round((hover.values[name] ?? 0) * 100)}%
                </p>
              ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {emotions.map((name, i) => (
          <div key={name} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${EMOTION_SWATCH_CLASSES[i % EMOTION_SWATCH_CLASSES.length]}`} />
            <span className="font-sans text-xs" style={{ color: 'var(--text2)' }}>
              {capitalize(name)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

// --- Activity (calendar heatmap) ---

const CELL = 11
const CELL_GAP = 3
const STEP = CELL + CELL_GAP
const GUTTER_LEFT = 18
const HEADER_H = 16

function heatLevel(count: number, maxCount: number): number {
  if (count === 0) return 0
  if (maxCount <= 1) return 4
  const ratio = count / maxCount
  if (ratio > 0.75) return 4
  if (ratio > 0.5) return 3
  if (ratio > 0.25) return 2
  return 1
}

const HEAT_OPACITY = [0, 0.28, 0.52, 0.76, 1]

function weekdayOf(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=Sun..6=Sat
}

function formatLongDate(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(Date.UTC(y, m - 1, d, 12)),
  )
}

function ActivityHeatmapCard({ days }: { days: ActivityDay[] }) {
  const [hover, setHover] = useState<ActivityDay | null>(null)

  const { columns, cells, monthLabels, maxCount } = useMemo(() => {
    const leading = days.length > 0 ? weekdayOf(days[0].day) : 0
    const total = leading + days.length
    const cols = Math.max(1, Math.ceil(total / 7))
    const grid: (ActivityDay | null)[][] = Array.from({ length: cols }, () => Array<ActivityDay | null>(7).fill(null))
    days.forEach((d, i) => {
      const idx = leading + i
      const c = Math.floor(idx / 7)
      const r = idx % 7
      grid[c][r] = d
    })
    const max = Math.max(0, ...days.map((d) => d.count))

    const labels: { col: number; label: string }[] = []
    let lastMonth = -1
    grid.forEach((col, c) => {
      const first = col.find((cell): cell is ActivityDay => cell !== null)
      if (!first) return
      const [, m, d] = first.day.split('-').map(Number)
      if (d <= 7 && m !== lastMonth) {
        lastMonth = m
        labels.push({
          col: c,
          label: new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(Date.UTC(2020, m - 1, 1))),
        })
      }
    })

    return { columns: cols, cells: grid, monthLabels: labels, maxCount: max }
  }, [days])

  const width = GUTTER_LEFT + columns * STEP
  const height = HEADER_H + 7 * STEP

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h3 className="serif text-base font-semibold" style={{ color: 'var(--text)' }}>
          Activity
        </h3>
        <p className="font-sans text-xs" style={{ color: 'var(--text2)' }}>
          {hover
            ? `${formatLongDate(hover.day)} · ${hover.count} ${hover.count === 1 ? 'entry' : 'entries'}`
            : 'The last 17 weeks — hover a day to see its count.'}
        </p>
      </div>

      {days.length === 0 ? (
        <p className="py-6 text-center font-sans text-sm" style={{ color: 'var(--text2)' }}>
          No activity yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            role="img"
            aria-label="Journaling activity calendar heatmap"
          >
            {[1, 3, 5].map((r) => (
              <text key={r} x={GUTTER_LEFT - 4} y={HEADER_H + r * STEP + CELL / 2} textAnchor="end" dominantBaseline="middle" fontSize={8} fill="var(--text3)">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'][r]}
              </text>
            ))}
            {monthLabels.map(({ col, label }) => (
              <text key={col} x={GUTTER_LEFT + col * STEP} y={HEADER_H - 5} fontSize={9} fill="var(--text3)">
                {label}
              </text>
            ))}
            {cells.map((col, c) =>
              col.map((cell, r) => {
                if (!cell) return null
                const level = heatLevel(cell.count, maxCount)
                const x = GUTTER_LEFT + c * STEP
                const y = HEADER_H + r * STEP
                return (
                  <g key={`${c}-${r}`}>
                    <rect
                      x={x}
                      y={y}
                      width={CELL}
                      height={CELL}
                      rx={2.5}
                      fill={level === 0 ? 'var(--hairline2)' : 'var(--accent)'}
                      fillOpacity={level === 0 ? 1 : HEAT_OPACITY[level]}
                    />
                    <rect
                      x={x}
                      y={y}
                      width={CELL}
                      height={CELL}
                      fill="transparent"
                      tabIndex={0}
                      role="img"
                      aria-label={`${formatLongDate(cell.day)}: ${cell.count} ${cell.count === 1 ? 'entry' : 'entries'}`}
                      onMouseEnter={() => setHover(cell)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(cell)}
                      onBlur={() => setHover(null)}
                    >
                      <title>
                        {formatLongDate(cell.day)}: {cell.count} {cell.count === 1 ? 'entry' : 'entries'}
                      </title>
                    </rect>
                  </g>
                )
              }),
            )}
          </svg>
        </div>
      )}
    </Card>
  )
}

// --- How you journal (donut) ---

const TYPE_STROKE_CLASSES: Record<JournalType, string> = {
  text: 'stroke-accent dark:stroke-accentDk',
  voice: 'stroke-typeVoice dark:stroke-typeVoiceDk',
  video: 'stroke-typeVideo dark:stroke-typeVideoDk',
  image: 'stroke-typeImage dark:stroke-typeImageDk',
}
const TYPE_BG_CLASSES: Record<JournalType, string> = {
  text: 'bg-accent dark:bg-accentDk',
  voice: 'bg-typeVoice dark:bg-typeVoiceDk',
  video: 'bg-typeVideo dark:bg-typeVideoDk',
  image: 'bg-typeImage dark:bg-typeImageDk',
}
const TYPE_LABEL: Record<JournalType, string> = {
  text: 'Text',
  voice: 'Voice',
  video: 'Video',
  image: 'Photo',
}

const DONUT_SIZE = 160
const DONUT_R = 62
const DONUT_STROKE = 26
const DONUT_GAP = 3
const DONUT_CIRC = 2 * Math.PI * DONUT_R

function TypeDonutCard({ types }: { types: TypeCountEntry[] }) {
  const [hover, setHover] = useState<JournalType | null>(null)
  const total = types.reduce((sum, t) => sum + t.count, 0)

  const slices = useMemo(() => {
    let offset = 0
    return types.map((t) => {
      const sliceLen = (t.count / total) * DONUT_CIRC
      const seg = { ...t, len: Math.max(sliceLen - DONUT_GAP, 0), start: offset + DONUT_GAP / 2 }
      offset += sliceLen
      return seg
    })
  }, [types, total])

  const centerType = hover ? types.find((t) => t.type === hover) : undefined

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h3 className="serif text-base font-semibold" style={{ color: 'var(--text)' }}>
          How you journal
        </h3>
        <p className="font-sans text-xs" style={{ color: 'var(--text2)' }}>
          Entries by type.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <div className="relative shrink-0" style={{ width: DONUT_SIZE, height: DONUT_SIZE }}>
          <svg viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`} width={DONUT_SIZE} height={DONUT_SIZE} role="img" aria-label="Entries by type">
            {slices.map((s) => (
              <circle
                key={s.type}
                cx={DONUT_SIZE / 2}
                cy={DONUT_SIZE / 2}
                r={DONUT_R}
                fill="none"
                strokeWidth={DONUT_STROKE}
                strokeDasharray={`${s.len} ${DONUT_CIRC - s.len}`}
                strokeDashoffset={-s.start}
                transform={`rotate(-90 ${DONUT_SIZE / 2} ${DONUT_SIZE / 2})`}
                className={`${TYPE_STROKE_CLASSES[s.type]} transition-opacity`}
                opacity={hover && hover !== s.type ? 0.35 : 1}
                onMouseEnter={() => setHover(s.type)}
                onMouseLeave={() => setHover(null)}
                tabIndex={0}
                aria-label={`${TYPE_LABEL[s.type]}: ${s.count} entries`}
                onFocus={() => setHover(s.type)}
                onBlur={() => setHover(null)}
              >
                <title>
                  {TYPE_LABEL[s.type]}: {s.count} ({Math.round((s.count / total) * 100)}%)
                </title>
              </circle>
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {centerType ? (
              <>
                <span className="font-sans text-lg font-bold" style={{ color: 'var(--text)' }}>
                  {centerType.count}
                </span>
                <span className="font-sans text-[11px]" style={{ color: 'var(--text2)' }}>
                  {TYPE_LABEL[centerType.type]}
                </span>
              </>
            ) : (
              <>
                <span className="font-sans text-lg font-bold" style={{ color: 'var(--text)' }}>
                  {total}
                </span>
                <span className="font-sans text-[11px]" style={{ color: 'var(--text2)' }}>
                  entries
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {types.map((t) => (
            <div key={t.type} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${TYPE_BG_CLASSES[t.type]}`} />
              <span className="font-sans text-sm" style={{ color: 'var(--text)' }}>
                {TYPE_LABEL[t.type]}
              </span>
              <span className="font-sans text-xs" style={{ color: 'var(--text2)' }}>
                {t.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
