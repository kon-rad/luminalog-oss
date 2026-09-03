import { layoutPyramid, type PyramidLayout } from './pyramidLayout'
import { renderPyramidSvg } from './pyramidRender'
import { mountCognitiveMap, type MapHandle } from './mount'
import { DEFAULT_LIGHT, DEFAULT_DARK } from './theme'
import type { CognitiveMap } from './types'

export type PeriodType = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'lifetime'

// Coarsest first. Index into this array, not the PeriodType strings themselves, is
// what "one tier up/down" means throughout this file.
const TIERS: PeriodType[] = ['lifetime', 'year', 'quarter', 'month', 'week', 'day']

function tierBelow(t: PeriodType): PeriodType | null {
  const i = TIERS.indexOf(t)
  return i < TIERS.length - 1 ? TIERS[i + 1]! : null
}
function tierAbove(t: PeriodType): PeriodType | null {
  const i = TIERS.indexOf(t)
  return i > 0 ? TIERS[i - 1]! : null
}

export interface PyramidPoint {
  periodIndex: number
  x: number
  y: number
  z: number
  childCount: number
  /** The periodIndex of the tier directly above this one that this point rolls
   *  into. null for 'year' (parent is the single lifetime row) and 'lifetime'. */
  parentIndex: number | null
}

export interface FocusInfo {
  periodType: PeriodType
  periodIndex: number
  childCount: number
  narrative: string | null
}

export interface ZoomPyramidOptions {
  /** Which tier the pyramid opens at. Defaults to 'week' per the design spec:
   *  light users have too little data for year/lifetime to mean anything yet, and
   *  heavy users still land somewhere immediately legible. */
  initialTier?: PeriodType
  /** Fired whenever a tier is shown for the first time and its points are not yet
   *  cached. One-way, fire-and-forget: safe across a WKWebView bridge that cannot
   *  correlate a request to a response. Answer via `setTierData`. */
  onNeedTierData?: (periodType: PeriodType) => void
  /** Fired when a dot is focused (tapped) and its narrative has not yet arrived.
   *  Answer via `setNarrative`. */
  onNeedNarrative?: (periodType: PeriodType, periodIndex: number) => void
  /** Fired when the user drills past the day tier into an entry and no map has
   *  been pushed for that day yet. The host resolves which entry to show (a day
   *  may hold more than one; Track 1 stores no entry-level position, so this is
   *  entirely the host's call) and answers via `setEntryMap`. */
  onNeedEntry?: (dayPeriodIndex: number) => void
  /** Fired whenever the focused dot changes (a fresh tap, or a pushed narrative
   *  landing on the currently focused dot). Never fired for a drill-in/out: the
   *  renderer draws dots, never narrative text, so the host renders this in its
   *  own chrome (a caption region below the canvas), the same way it already owns
   *  the entry tier's legend sheet. */
  onFocusChange?: (info: FocusInfo | null) => void
  /** Forwarded verbatim from the delegated entry-tier `mountCognitiveMap`. */
  onSelectBeat?: (beatId: string) => void
  /** CSS custom property overrides. The host owns the palette; see theme.ts. */
  theme?: Record<string, string>
  colorScheme?: 'light' | 'dark'
  /** Copy for the empty-tier state, so the host can localize it. */
  emptyMessage?: string
}

export interface ZoomPyramidHandle {
  /** Pushes every point of one tier. Ignored (no re-render) unless that tier is
   *  currently on screen; cached regardless, so a later drill into it is instant. */
  setTierData(periodType: PeriodType, points: PyramidPoint[]): void
  /** Pushes one period's narrative paragraph. */
  setNarrative(periodType: PeriodType, periodIndex: number, narrative: string): void
  /** Pushes the resolved cognitive map for one day, so the renderer can delegate to
   *  `mountCognitiveMap` at the entry tier. */
  setEntryMap(dayPeriodIndex: number, map: CognitiveMap): void
  /** Drills into one dot of the current tier. Exposed alongside the pinch gesture
   *  so a host can offer its own tap/keyboard affordance without the renderer
   *  knowing anything about that UI. */
  drillIn(periodIndex: number): void
  /** Moves up one tier: out of the entry view back to its day, out of a drilled-in
   *  child view back to its parent's siblings, or to the next coarser tier
   *  unfiltered when already at the top of the current drill stack. No-op at the
   *  lifetime tier, the coarsest tier there is. */
  zoomOut(): void
  destroy(): void
}

interface ViewState { tier: PeriodType; parentIndex: number | null }

const MIN_SCALE = 0.5
const MAX_SCALE = 3
const DRILL_IN_SCALE = MAX_SCALE * 1.15
const DRILL_OUT_SCALE = MIN_SCALE * 0.85

/**
 * Mount the day-through-lifetime zoom pyramid into `el`. Draws dots only, never
 * fetches, and delegates to the existing `mountCognitiveMap` inside the SAME host
 * element once the user drills past the day tier into a single entry, so the whole
 * stack is one canvas with no screen transition (see the design spec's "same
 * canvas, not a linked screen").
 */
export function mountZoomPyramid(
  el: HTMLElement,
  opts: ZoomPyramidOptions = {},
): ZoomPyramidHandle {
  const fallback = opts.colorScheme === 'dark' ? DEFAULT_DARK : DEFAULT_LIGHT
  for (const [name, value] of Object.entries({ ...fallback, ...(opts.theme ?? {}) })) {
    el.style.setProperty(name, value)
  }
  el.style.touchAction = 'none'
  el.style.overflow = 'hidden'
  el.style.position = 'relative'

  const tierCache = new Map<PeriodType, PyramidPoint[]>()
  const narrativeCache = new Map<PeriodType, Map<number, string>>()
  const entryMapCache = new Map<number, CognitiveMap>()
  const requestedTiers = new Set<PeriodType>()
  const requestedNarratives = new Set<string>()
  const requestedEntries = new Set<number>()

  const stack: ViewState[] = [{ tier: opts.initialTier ?? 'week', parentIndex: null }]
  let entryDayIndex: number | null = null
  let entryHandle: MapHandle | null = null
  let focusedPeriodIndex: number | null = null

  let viewport: HTMLDivElement | null = null
  let scale = 1, tx = 0, ty = 0
  let currentLayout: PyramidLayout = { points: [], width: 800, height: 800 }

  const pointers = new Map<number, { x: number; y: number }>()
  let pinchStart: { distance: number; scale: number } | null = null
  let pinchRawScale = 1
  let lastPinchCenter: { x: number; y: number } | null = null

  const currentView = (): ViewState => stack[stack.length - 1]!

  function narrativeFor(tier: PeriodType, periodIndex: number): string | null {
    return narrativeCache.get(tier)?.get(periodIndex) ?? null
  }

  function pointsForView(view: ViewState): PyramidPoint[] {
    const all = tierCache.get(view.tier) ?? []
    return view.parentIndex === null ? all : all.filter(p => p.parentIndex === view.parentIndex)
  }

  function ensureTierRequested(tier: PeriodType) {
    if (tierCache.has(tier) || requestedTiers.has(tier)) return
    requestedTiers.add(tier)
    opts.onNeedTierData?.(tier)
  }

  function ensureNarrativeRequested(tier: PeriodType, periodIndex: number) {
    const key = `${tier}:${periodIndex}`
    if (narrativeCache.get(tier)?.has(periodIndex) || requestedNarratives.has(key)) return
    requestedNarratives.add(key)
    opts.onNeedNarrative?.(tier, periodIndex)
  }

  function applyTransform() {
    if (viewport) viewport.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`
  }

  function draw() {
    if (entryDayIndex !== null) return // entry mode owns the DOM while active
    el.replaceChildren()
    viewport = null

    const view = currentView()
    ensureTierRequested(view.tier)
    const points = pointsForView(view)

    if (points.length === 0) {
      const empty = document.createElement('div')
      empty.setAttribute('data-cm-empty', 'true')
      empty.textContent = opts.emptyMessage ?? 'Nothing here yet.'
      empty.style.cssText =
        'display:flex;align-items:center;justify-content:center;height:100%;' +
        'font-size:14px;opacity:0.6;padding:24px;text-align:center;'
      el.appendChild(empty)
      currentLayout = { points: [], width: 800, height: 800 }
      return
    }

    const narratives = narrativeCache.get(view.tier)
    const withNarrative = new Set<number>(narratives ? Array.from(narratives.keys()) : [])
    currentLayout = layoutPyramid(points, withNarrative)

    const svg = renderPyramidSvg(currentLayout, focusedPeriodIndex)
    svg.setAttribute('width', String(currentLayout.width))
    svg.setAttribute('height', String(currentLayout.height))

    viewport = document.createElement('div')
    viewport.style.transformOrigin = '0 0'
    viewport.appendChild(svg)
    el.appendChild(viewport)

    const box = el.getBoundingClientRect()
    const availableWidth = box.width || currentLayout.width
    const availableHeight = box.height || currentLayout.height
    const fit = Math.min(availableWidth / currentLayout.width, availableHeight / currentLayout.height, 1)
    scale = Math.max(MIN_SCALE, fit || 1)
    tx = Math.max(0, (availableWidth - currentLayout.width * scale) / 2)
    ty = Math.max(0, (availableHeight - currentLayout.height * scale) / 2)
    applyTransform()
  }

  function periodIdFrom(target: EventTarget | null): number | null {
    const node = (target as Element | null)?.closest?.('g[data-period-index]')
    const raw = node?.getAttribute('data-period-index')
    return raw == null ? null : Number(raw)
  }

  function focus(periodIndex: number) {
    const view = currentView()
    const point = pointsForView(view).find(p => p.periodIndex === periodIndex)
    if (!point) return
    focusedPeriodIndex = periodIndex
    ensureNarrativeRequested(view.tier, periodIndex)
    opts.onFocusChange?.({
      periodType: view.tier,
      periodIndex,
      childCount: point.childCount,
      narrative: narrativeFor(view.tier, periodIndex),
    })
    draw()
  }

  function enterEntry(dayPeriodIndex: number) {
    entryDayIndex = dayPeriodIndex
    el.replaceChildren()
    viewport = null
    const map = entryMapCache.get(dayPeriodIndex)
    if (!map) {
      if (!requestedEntries.has(dayPeriodIndex)) {
        requestedEntries.add(dayPeriodIndex)
        opts.onNeedEntry?.(dayPeriodIndex)
      }
      const loading = document.createElement('div')
      loading.setAttribute('data-cm-entry-loading', 'true')
      loading.textContent = 'Loading...'
      loading.style.cssText =
        'display:flex;align-items:center;justify-content:center;height:100%;font-size:14px;opacity:0.6;'
      el.appendChild(loading)
      return
    }
    entryHandle = mountCognitiveMap(el, map, {
      theme: opts.theme,
      colorScheme: opts.colorScheme,
      onSelectBeat: opts.onSelectBeat,
    })
  }

  function exitEntry() {
    entryHandle?.destroy()
    entryHandle = null
    entryDayIndex = null
    draw()
  }

  function drillIn(periodIndex: number) {
    if (entryDayIndex !== null) return
    const view = currentView()
    const point = pointsForView(view).find(p => p.periodIndex === periodIndex)
    if (!point) return

    focusedPeriodIndex = null
    if (view.tier === 'day') {
      enterEntry(periodIndex)
      return
    }
    const next = tierBelow(view.tier)
    if (!next) return
    stack.push({ tier: next, parentIndex: periodIndex })
    draw()
  }

  function zoomOut() {
    if (entryDayIndex !== null) {
      exitEntry()
      return
    }
    focusedPeriodIndex = null
    if (stack.length > 1) {
      stack.pop()
      draw()
      return
    }
    const above = tierAbove(currentView().tier)
    if (!above) return // already at lifetime, the coarsest tier
    stack.push({ tier: above, parentIndex: null })
    draw()
  }

  // --- gesture: tap/keyboard focuses; pinch drills in/out. Pan translates within
  // a tier. Mirrors mount.ts's pointer handling (see its comment on Array.from vs
  // spreading a MapIterator: this file is compiled by the same three toolchains). ---

  const onClick = (event: MouseEvent) => {
    const id = periodIdFrom(event.target)
    if (id !== null) focus(id)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    const id = periodIdFrom(event.target)
    if (id !== null) { event.preventDefault(); focus(id) }
  }

  const distance = (): number => {
    const points = Array.from(pointers.values())
    const a = points[0]
    const b = points[1]
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
  }

  const center = (): { x: number; y: number } => {
    const points = Array.from(pointers.values())
    const a = points[0]!
    const b = points[1]!
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  }

  function nearestPoint(screenX: number, screenY: number): number | null {
    if (currentLayout.points.length === 0) return null
    const box = el.getBoundingClientRect()
    const layoutX = (screenX - box.left - tx) / scale
    const layoutY = (screenY - box.top - ty) / scale
    let best: { periodIndex: number; dist: number } | null = null
    for (const p of currentLayout.points) {
      const d = Math.hypot(p.x - layoutX, p.y - layoutY)
      if (!best || d < best.dist) best = { periodIndex: p.periodIndex, dist: d }
    }
    return best?.periodIndex ?? null
  }

  const onPointerDown = (event: PointerEvent) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.size === 2) {
      pinchStart = { distance: distance(), scale }
      pinchRawScale = scale
    }
  }

  const onPointerMove = (event: PointerEvent) => {
    const previous = pointers.get(event.pointerId)
    if (!previous) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointers.size === 2 && pinchStart && pinchStart.distance > 0) {
      const ratio = distance() / pinchStart.distance
      pinchRawScale = pinchStart.scale * ratio
      lastPinchCenter = center()
      scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinchRawScale))
    } else if (pointers.size === 1) {
      tx += event.clientX - previous.x
      ty += event.clientY - previous.y
    }
    applyTransform()
  }

  const onPointerUp = (event: PointerEvent) => {
    pointers.delete(event.pointerId)
    if (pointers.size < 2 && pinchStart) {
      if (pinchRawScale >= DRILL_IN_SCALE && lastPinchCenter) {
        const id = nearestPoint(lastPinchCenter.x, lastPinchCenter.y)
        if (id !== null) drillIn(id)
      } else if (pinchRawScale <= DRILL_OUT_SCALE) {
        zoomOut()
      }
      pinchStart = null
      lastPinchCenter = null
    }
  }

  el.addEventListener('click', onClick)
  el.addEventListener('keydown', onKeyDown)
  el.addEventListener('pointerdown', onPointerDown)
  el.addEventListener('pointermove', onPointerMove)
  el.addEventListener('pointerup', onPointerUp)
  el.addEventListener('pointercancel', onPointerUp)

  draw()

  return {
    setTierData(periodType, points) {
      tierCache.set(periodType, points)
      requestedTiers.delete(periodType)
      if (currentView().tier === periodType && entryDayIndex === null) draw()
    },
    setNarrative(periodType, periodIndex, narrative) {
      if (!narrativeCache.has(periodType)) narrativeCache.set(periodType, new Map())
      narrativeCache.get(periodType)!.set(periodIndex, narrative)
      requestedNarratives.delete(`${periodType}:${periodIndex}`)
      if (currentView().tier !== periodType) return
      if (focusedPeriodIndex === periodIndex) {
        const point = pointsForView(currentView()).find(p => p.periodIndex === periodIndex)
        if (point) {
          opts.onFocusChange?.({ periodType, periodIndex, childCount: point.childCount, narrative })
        }
      }
      draw()
    },
    setEntryMap(dayPeriodIndex, map) {
      entryMapCache.set(dayPeriodIndex, map)
      requestedEntries.delete(dayPeriodIndex)
      if (entryDayIndex === dayPeriodIndex) enterEntry(dayPeriodIndex)
    },
    drillIn,
    zoomOut,
    destroy() {
      el.removeEventListener('click', onClick)
      el.removeEventListener('keydown', onKeyDown)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      entryHandle?.destroy()
      el.replaceChildren()
    },
  }
}
