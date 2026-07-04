// Pure, on-device analytics helpers for the Insights dashboard (design B.13 /
// M8-T1). No React here — everything is a plain function over
// `JournalEntry[]` so it's unit-testable in isolation from `InsightsModal`.
// Every computation runs client-side over the already-decrypted entry stream
// (design §3): nothing here talks to the network.

import { localDayKey } from '@/lib/stats/dailyGoalStreak'
import type { JournalEntry, JournalType } from '@/lib/firestore/models'

// --- word cloud ---

/** A small English stopword set — common function words that would
 * otherwise dominate a raw word-frequency count without carrying any
 * "your words" signal. Not exhaustive; tuned for journal prose. */
const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'your', 'with', 'that',
  'this', 'was', 'were', 'have', 'has', 'had', 'from', 'they', 'them', 'their',
  'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how', 'all', 'each',
  'few', 'more', 'most', 'other', 'some', 'such', 'nor', 'only', 'own', 'same',
  'than', 'too', 'very', 'just', 'now', 'then', 'there', 'here', 'about',
  'into', 'over', 'under', 'again', 'further', 'once', 'out', 'off', 'above',
  'below', 'because', 'while', 'after', 'before', 'between', 'through',
  'during', 'without', 'against', 'around', 'among', 'she', 'her', 'his',
  'him', 'himself', 'herself', 'itself', 'myself', 'yourself', 'ourselves',
  'themselves', 'been', 'being', 'does', 'did', 'doing', 'would', 'could',
  'should', 'shall', 'will', 'can', 'may', 'might', 'must', 'these', 'those',
  'ain', 'aren', 'couldn', 'didn', 'doesn', 'hadn', 'hasn', 'haven', 'isn',
  'shan', 'shouldn', 'wasn', 'weren', 'won', 'wouldn', 'get', 'got', 'like',
  'really', 'still', 'much', 'many', 'also', 'even', 'back', 'went', 'going',
  'today', 'yesterday', 'thing', 'things', 'one', 'two', 'day', 'days',
  'time', 'know', 'think', 'feel', 'felt', 'lot', 'bit', 'way', 'need',
  'want', 'make', 'made', 'said', 'say', 'come', 'came', 'take', 'took',
])

const MIN_WORD_LENGTH = 3
const DEFAULT_WORD_LIMIT = 60

export interface WordFrequency {
  word: string
  count: number
}

/**
 * Concatenates `contents`, lowercases, strips punctuation (keeping intra-word
 * apostrophes/hyphens so "don't"/"self-care" stay one token), splits on
 * whitespace, drops stopwords + tokens shorter than 3 chars and pure-numeric
 * tokens, counts frequency, and returns the top `limit` (~60) by count desc
 * (ties broken alphabetically for a stable order across renders).
 */
export function wordFrequencies(contents: string[], limit = DEFAULT_WORD_LIMIT): WordFrequency[] {
  const counts = new Map<string, number>()

  for (const content of contents) {
    const tokens = content
      .toLowerCase()
      // Strip everything except letters/numbers/whitespace/apostrophe/hyphen —
      // punctuation becomes a token boundary (a space), never glued onto a
      // word. ASCII-only (no `u` regex flag — the project's `tsconfig.json`
      // target doesn't support Unicode property escapes; this is a config
      // file we don't touch for this feature).
      .replace(/[^a-z0-9\s'-]+/g, ' ')
      .split(/\s+/)

    for (const raw of tokens) {
      // Trim leading/trailing apostrophes/hyphens left over from punctuation
      // stripping (e.g. a trailing quote: `"quiet."` -> `quiet` not `quiet.`).
      const word = raw.replace(/^['-]+|['-]+$/g, '')
      if (word.length < MIN_WORD_LENGTH) continue
      if (STOPWORDS.has(word)) continue
      if (!/[a-z]/.test(word)) continue // drop pure-numeric tokens
      counts.set(word, (counts.get(word) ?? 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, limit)
}

// --- activity heatmap ---

/** The calendar-heatmap window (design B.13 "~119-day window" — 17 weeks). */
export const ACTIVITY_WINDOW_DAYS = 119

export interface ActivityDay {
  /** Local `YYYY-MM-DD` day key. */
  day: string
  count: number
}

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`)

/**
 * A DENSE per-day entry count over the last `ACTIVITY_WINDOW_DAYS` local
 * calendar days (today inclusive), oldest first — missing days are filled
 * with `count: 0` so the calendar-heatmap grid never has holes. Day bucketing
 * uses the user's timezone (`localDayKey`), matching the goal-streak logic.
 */
export function activityByDay(
  entries: JournalEntry[],
  timezone: string,
  now: Date = new Date(),
): ActivityDay[] {
  const counts = new Map<string, number>()
  for (const entry of entries) {
    const key = localDayKey(entry.createdAt, timezone)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  // Walk back from "today" (in the user's timezone) as plain Y/M/D parts via
  // a neutral UTC vehicle — DST-safe and correct across month/year rollovers,
  // matching the day-math approach in `dailyGoalStreak.ts`.
  const todayKey = localDayKey(now, timezone)
  const [ty, tm, td] = todayKey.split('-').map(Number)
  const todayUtcMs = Date.UTC(ty, tm - 1, td)

  const days: ActivityDay[] = []
  for (let i = ACTIVITY_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(todayUtcMs - i * 86_400_000)
    const key = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
    days.push({ day: key, count: counts.get(key) ?? 0 })
  }
  return days
}

// --- type donut ---

export interface TypeCountEntry {
  type: JournalType
  count: number
}

/** Fixed rendering order (matches the Journal filter chips / TypePill). */
const TYPE_ORDER: JournalType[] = ['text', 'voice', 'video', 'image']

/** Counts entries by `type`, in a fixed type order, omitting types with a
 * zero count (so the donut/legend never shows an empty slice). */
export function typeCounts(entries: JournalEntry[]): TypeCountEntry[] {
  const counts = new Map<JournalType, number>()
  for (const entry of entries) counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1)
  return TYPE_ORDER.filter((type) => (counts.get(type) ?? 0) > 0).map((type) => ({
    type,
    count: counts.get(type) ?? 0,
  }))
}

// --- emotional trends ---

/**
 * The wire shape of `entry.emotion` (design §3 / server schema) — populated
 * only via the daily-report path, so it's dormant/sparse and NOT part of the
 * shared `JournalEntry` model yet. Read defensively off the raw entry rather
 * than widening the shared model for a field most entries will never carry.
 */
export interface EmotionScore {
  source?: string
  scores?: Record<string, number>
  top?: { name: string; score: number }[]
  model?: string
  scoredAt?: unknown
}

/** Below this many entries-with-emotion, the trends card self-hides (design
 * §3) rather than rendering a near-empty chart. */
export const EMOTION_MIN_ENTRIES = 3

/** The number of top-by-total emotions plotted as lines (design B.13). */
const TOP_EMOTION_COUNT = 4

const getEmotion = (entry: JournalEntry): EmotionScore | undefined =>
  (entry as JournalEntry & { emotion?: EmotionScore }).emotion

/** Per-emotion score map for one entry — prefers `scores{}`; falls back to
 * `top[]` when `scores` is absent/empty. `{}` when neither is usable. */
function emotionScoreMap(emotion: EmotionScore | undefined): Record<string, number> {
  if (!emotion) return {}
  if (emotion.scores && Object.keys(emotion.scores).length > 0) return emotion.scores
  if (emotion.top && emotion.top.length > 0) {
    const map: Record<string, number> = {}
    for (const { name, score } of emotion.top) map[name] = score
    return map
  }
  return {}
}

/** Whether `entries` carry enough emotion data for the trends card to render
 * at all (design §3 self-hide rule). */
export function hasEmotionData(entries: JournalEntry[]): boolean {
  let count = 0
  for (const entry of entries) {
    if (Object.keys(emotionScoreMap(getEmotion(entry))).length > 0) count += 1
    if (count >= EMOTION_MIN_ENTRIES) return true
  }
  return false
}

export interface EmotionDayBucket {
  /** Local `YYYY-MM-DD` day key. */
  day: string
  /** Per-emotion AVERAGE score for that day, keyed by emotion name — only
   * emotions present that day are keyed (no zero-filling). */
  values: Record<string, number>
}

export interface EmotionSeries {
  /** The top ~4 emotions by total score, in a FIXED order (highest total
   * first) — this order is the categorical color assignment and never
   * reshuffles for the same input set. Empty when below `EMOTION_MIN_ENTRIES`. */
  emotions: string[]
  /** One bucket per local day that has emotion data, oldest first. */
  days: EmotionDayBucket[]
}

/**
 * Buckets entries-with-emotion by local day, averaging each emotion's score
 * per day, and returns the top ~4 emotions by total score across all days
 * (a fixed order, used as the categorical color assignment upstream). Below
 * `EMOTION_MIN_ENTRIES` entries carrying emotion data, returns
 * `{emotions: [], days: []}` so the caller can self-hide the card.
 */
export function emotionSeries(entries: JournalEntry[], timezone: string): EmotionSeries {
  const withEmotion = entries.filter(
    (e) => Object.keys(emotionScoreMap(getEmotion(e))).length > 0,
  )
  if (withEmotion.length < EMOTION_MIN_ENTRIES) return { emotions: [], days: [] }

  const byDay = new Map<string, Map<string, { sum: number; count: number }>>()
  const totals = new Map<string, number>()

  for (const entry of withEmotion) {
    const dayKey = localDayKey(entry.createdAt, timezone)
    let dayMap = byDay.get(dayKey)
    if (!dayMap) {
      dayMap = new Map()
      byDay.set(dayKey, dayMap)
    }
    for (const [name, score] of Object.entries(emotionScoreMap(getEmotion(entry)))) {
      const bucket = dayMap.get(name) ?? { sum: 0, count: 0 }
      bucket.sum += score
      bucket.count += 1
      dayMap.set(name, bucket)
      totals.set(name, (totals.get(name) ?? 0) + score)
    }
  }

  const emotions = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_EMOTION_COUNT)
    .map(([name]) => name)

  const days = Array.from(byDay.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([day, dayMap]) => {
      const values: Record<string, number> = {}
      for (const name of emotions) {
        const bucket = dayMap.get(name)
        if (bucket) values[name] = bucket.sum / bucket.count
      }
      return { day, values }
    })

  return { emotions, days }
}
