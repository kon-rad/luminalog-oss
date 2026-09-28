// Pure logic for period summaries (spec: docs/superpowers/specs/2026-09-26-period-summaries-design.md).
// One summary per calendar period (day, ISO week, month, quarter, year, all-time),
// built recursively on device from the period's children and sent here as PLAINTEXT.
// Dependency-free so it unit-tests without booting config/Firebase, like dailyMirror.ts.

export const PERIOD_SUMMARY_TYPES = ['day', 'week', 'month', 'quarter', 'year', 'all'] as const
export type PeriodSummaryType = typeof PERIOD_SUMMARY_TYPES[number]

/** Hard cap on inputs per call. The client already caps days at 30 entries and months at 31 days. */
export const PERIOD_SUMMARY_MAX_CHILDREN = 40
/** Per-input character cap, so one runaway entry cannot crowd out the rest. */
export const PERIOD_SUMMARY_CHILD_MAX_CHARS = 1000
/** Cap on a day child's `excerpt`: the start of the entry in the user's own words. */
export const PERIOD_SUMMARY_EXCERPT_MAX_CHARS = 600
/** Anchors kept per child in the request and per summary in the reply. */
export const PERIOD_SUMMARY_MAX_ANCHORS = 3
export const PERIOD_SUMMARY_QUOTE_MAX_CHARS = 200
/** Threads kept per child in the request and per summary in the reply. */
export const PERIOD_SUMMARY_MAX_THREADS = 5
export const PERIOD_SUMMARY_THREAD_MAX_CHARS = 40
/** Longest title kept; the prompt asks for 2 to 6 words, this caps a model that ignores it. */
export const PERIOD_SUMMARY_TITLE_MAX_WORDS = 6

/** A verbatim quote from one entry. Always points at an entry, at every tier. */
export interface PeriodSummaryAnchor { entryId: string; quote: string }

/** Entry ids of the period's high point, low point, and turning point, when there clearly is one. */
export interface PeriodSummaryKeyScenes { high: string | null; low: string | null; turning: string | null }

/**
 * One input. For a day: an entry (`id` is the entry id, `text` its summary or the
 * start of its content, `excerpt` the start of its content, always sent when there is any).
 * Above a day: a child period (`id` is its doc id, `text` its summary, plus the
 * child's own salience, anchors, and threads).
 */
export interface PeriodSummaryChild {
  id: string
  label: string
  text: string
  excerpt?: string
  salience?: number
  anchors: PeriodSummaryAnchor[]
  threads: string[]
}

export interface PeriodSummaryRequest {
  periodType: PeriodSummaryType
  periodLabel: string
  isOpen: boolean
  children: PeriodSummaryChild[]
}

export interface PeriodSummaryResult {
  title: string
  sentence: string
  summary: string
  salience: number
  anchors: PeriodSummaryAnchor[]
  keyScenes: PeriodSummaryKeyScenes
  threads: string[]
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

function clampSalience(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  if (!Number.isFinite(n)) return undefined
  return Math.min(10, Math.max(1, Math.round(n)))
}

function cleanAnchors(v: unknown): PeriodSummaryAnchor[] {
  if (!Array.isArray(v)) return []
  return v
    .map((a: any) => ({ entryId: str(a?.entryId), quote: str(a?.quote).slice(0, PERIOD_SUMMARY_QUOTE_MAX_CHARS) }))
    .filter(a => a.entryId && a.quote)
}

function cleanThreads(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of v) {
    const label = str(t).slice(0, PERIOD_SUMMARY_THREAD_MAX_CHARS).trim()
    if (!label || seen.has(label.toLowerCase())) continue
    seen.add(label.toLowerCase())
    out.push(label)
  }
  return out.slice(0, PERIOD_SUMMARY_MAX_THREADS)
}

/** Validates and normalizes the route body. Returns `{ error }` for a 400. */
export function parsePeriodSummaryRequest(body: unknown): PeriodSummaryRequest | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>
  const periodType = b.periodType
  if (typeof periodType !== 'string' || !PERIOD_SUMMARY_TYPES.includes(periodType as PeriodSummaryType)) {
    return { error: 'Invalid periodType' }
  }
  const periodLabel = typeof b.periodLabel === 'string' ? b.periodLabel.trim() : ''
  if (!periodLabel) return { error: 'Missing periodLabel' }

  const children = (Array.isArray(b.children) ? b.children : [])
    .filter((c: any) => str(c?.id) && typeof c?.label === 'string' && str(c?.text))
    .map((c: any): PeriodSummaryChild => {
      const child: PeriodSummaryChild = {
        id: str(c.id),
        label: c.label.trim(),
        text: str(c.text).slice(0, PERIOD_SUMMARY_CHILD_MAX_CHARS),
        anchors: cleanAnchors(c.anchors).slice(0, PERIOD_SUMMARY_MAX_ANCHORS),
        threads: cleanThreads(c.threads),
      }
      const excerpt = str(c.excerpt).slice(0, PERIOD_SUMMARY_EXCERPT_MAX_CHARS)
      if (excerpt) child.excerpt = excerpt
      const salience = clampSalience(c.salience)
      if (salience !== undefined) child.salience = salience
      return child
    })
    .slice(-PERIOD_SUMMARY_MAX_CHILDREN)
  if (children.length === 0) return { error: 'No children to summarize' }

  return { periodType: periodType as PeriodSummaryType, periodLabel, isOpen: b.isOpen === true, children }
}

/**
 * One block per child, in the order the client sent (chronological), joined by a
 * divider. Every quotable line names the entry id it belongs to: those ids are the
 * only ones the model may cite, and `parsePeriodSummary` enforces that.
 */
export function buildChildrenBlock(children: PeriodSummaryChild[]): string {
  return children.map(c => {
    const lines = [`[${c.label}]${c.salience !== undefined ? ` (salience ${c.salience})` : ''}`, c.text]
    if (c.excerpt) lines.push(`In their own words (entry ${c.id}): "${c.excerpt}"`)
    for (const a of c.anchors) lines.push(`Quote (entry ${a.entryId}): "${a.quote}"`)
    if (c.threads.length > 0) lines.push(`Threads: ${c.threads.join(', ')}`)
    return lines.join('\n')
  }).join('\n\n---\n\n')
}

/** Trims, drops wrapping quotes and trailing punctuation, caps the word count. '' if nothing is left. */
function cleanTitle(raw: string): string {
  const words = raw.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').replace(/[.!?,;:]+$/, '').trim()
    .split(/\s+/).filter(Boolean)
  return words.slice(0, PERIOD_SUMMARY_TITLE_MAX_WORDS).join(' ')
}

/** Case, whitespace, and curly-quote insensitive form used only for matching quotes to sources. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim()
}

/**
 * What the model may quote, per entry id. A day quotes only its entries' `excerpt`
 * (the user's own words; `text` is usually an AI summary, so it is never quotable).
 * Higher tiers quote only their children's anchors, so an anchor always traces
 * back to a real entry through every level.
 */
function quotableSources(req: PeriodSummaryRequest): Map<string, string[]> {
  const sources = new Map<string, string[]>()
  const add = (id: string, text: string) => sources.set(id, [...(sources.get(id) ?? []), norm(text)])
  for (const c of req.children) {
    if (req.periodType === 'day') { if (c.excerpt) add(c.id, c.excerpt) }
    else for (const a of c.anchors) add(a.entryId, a.quote)
  }
  return sources
}

/** Entry ids a key scene may name: a day's entries, or the entries its children quote. */
function sceneCandidates(req: PeriodSummaryRequest): Set<string> {
  return new Set(req.periodType === 'day'
    ? req.children.map(c => c.id)
    : req.children.flatMap(c => c.anchors.map(a => a.entryId)))
}

/**
 * Parses the model's JSON reply and grounds it against the request. Returns null
 * when title, sentence, summary, or salience is missing so the caller can retry
 * once. Anchors whose quote is not verbatim in the cited source, and key scenes
 * naming an entry the model was never shown, are dropped (not a failure). There is
 * deliberately no fallback text: a canned summary stored as memory is worse than none.
 */
export function parsePeriodSummary(raw: string, req: PeriodSummaryRequest): PeriodSummaryResult | null {
  let parsed: any
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    parsed = JSON.parse(match[0])
  } catch {
    return null
  }
  const title = typeof parsed?.title === 'string' ? cleanTitle(parsed.title) : ''
  const sentence = str(parsed?.sentence)
  const summary = str(parsed?.summary)
  const salience = clampSalience(parsed?.salience)
  if (!title || !sentence || !summary || salience === undefined) return null

  const sources = quotableSources(req)
  const anchors = cleanAnchors(parsed?.anchors)
    .filter(a => (sources.get(a.entryId) ?? []).some(src => src.includes(norm(a.quote))))
    .slice(0, PERIOD_SUMMARY_MAX_ANCHORS)

  const candidates = sceneCandidates(req)
  const scene = (v: unknown): string | null => {
    const id = str(v)
    return id && candidates.has(id) ? id : null
  }
  const ks = parsed?.keyScenes ?? {}
  const keyScenes = { high: scene(ks.high), low: scene(ks.low), turning: scene(ks.turning) }

  return { title, sentence, summary, salience, anchors, keyScenes, threads: cleanThreads(parsed?.threads) }
}
