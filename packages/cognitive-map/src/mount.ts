import { layout } from './layout'
import { renderSvg } from './render'
import { DEFAULT_LIGHT, DEFAULT_DARK } from './theme'
import { isCognitiveMap, type CognitiveMap } from './types'

export interface MountOptions {
  /** Fired when the reader taps a beat. The host opens the source quote. */
  onSelectBeat?: (beatId: string) => void
  /** CSS custom property overrides. The host owns the palette; see theme.ts. */
  theme?: Record<string, string>
  /** Which fallback palette to start from when `theme` omits a value. */
  colorScheme?: 'light' | 'dark'
  /** Copy for the empty state, so the host can localize it. */
  emptyMessage?: string
}

export interface MapHandle {
  update(map: CognitiveMap): void
  destroy(): void
}

const MIN_SCALE = 0.5
const MAX_SCALE = 3

/**
 * Mount a cognitive map into `el`, with scale-to-fit, pinch and drag panning, and
 * tap-to-select. Layout is in abstract units, so this is the only place that knows
 * about the viewport: rotating the device or resizing the window rescales the same
 * drawing rather than re-running layout.
 */
export function mountCognitiveMap(
  el: HTMLElement,
  map: CognitiveMap,
  opts: MountOptions = {},
): MapHandle {
  const fallback = opts.colorScheme === 'dark' ? DEFAULT_DARK : DEFAULT_LIGHT
  for (const [name, value] of Object.entries({ ...fallback, ...(opts.theme ?? {}) })) {
    el.style.setProperty(name, value)
  }
  el.style.touchAction = 'none'
  el.style.overflow = 'hidden'
  el.style.position = 'relative'

  let viewport: HTMLDivElement | null = null
  let scale = 1
  let tx = 0
  let ty = 0
  const pointers = new Map<number, { x: number; y: number }>()
  let pinchStart: { distance: number; scale: number } | null = null

  const applyTransform = () => {
    if (viewport) viewport.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`
  }

  const draw = (next: CognitiveMap) => {
    el.replaceChildren()
    viewport = null

    // A map with nothing to draw is a normal outcome for a very short entry, not an
    // error. Say so plainly instead of showing an empty box. A structurally invalid
    // map lands here too: better a calm message than a thrown exception inside a tab.
    if (!isCognitiveMap(next) || next.beats.filter(b => b.tier === 'map').length === 0) {
      const empty = document.createElement('div')
      empty.setAttribute('data-cm-empty', 'true')
      empty.textContent = opts.emptyMessage ?? 'Not enough here to map yet.'
      empty.style.cssText =
        'display:flex;align-items:center;justify-content:center;height:100%;' +
        'font-size:14px;opacity:0.6;padding:24px;text-align:center;'
      el.appendChild(empty)
      return
    }

    const result = layout(next)
    const svg = renderSvg(result)
    svg.setAttribute('width', String(result.width))
    svg.setAttribute('height', String(result.height))

    viewport = document.createElement('div')
    viewport.style.transformOrigin = '0 0'
    viewport.appendChild(svg)
    el.appendChild(viewport)

    // Scale to fit on first paint, never magnifying past 1:1, then centre the drawing
    // in the viewport. Centring on BOTH axes matters: a short map pinned to the top
    // leaves a slab of dead space under it, which on a phone reads as a broken screen
    // rather than a small map.
    const box = el.getBoundingClientRect()
    const availableWidth = box.width || result.width
    const availableHeight = box.height || result.height
    const fit = Math.min(availableWidth / result.width, availableHeight / result.height, 1)
    scale = Math.max(MIN_SCALE, fit || 1)
    tx = Math.max(0, (availableWidth - result.width * scale) / 2)
    ty = Math.max(0, (availableHeight - result.height * scale) / 2)
    applyTransform()
  }

  const beatIdFrom = (target: EventTarget | null): string | null => {
    const node = (target as Element | null)?.closest?.('g[data-beat-id]')
    return node?.getAttribute('data-beat-id') ?? null
  }

  const onClick = (event: MouseEvent) => {
    const id = beatIdFrom(event.target)
    if (id) opts.onSelectBeat?.(id)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    const id = beatIdFrom(event.target)
    if (id) { event.preventDefault(); opts.onSelectBeat?.(id) }
  }

  const distance = (): number => {
    const [a, b] = [...pointers.values()]
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
  }

  const onPointerDown = (event: PointerEvent) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.size === 2) pinchStart = { distance: distance(), scale }
  }

  const onPointerMove = (event: PointerEvent) => {
    const previous = pointers.get(event.pointerId)
    if (!previous) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointers.size === 2 && pinchStart && pinchStart.distance > 0) {
      const ratio = distance() / pinchStart.distance
      scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinchStart.scale * ratio))
    } else if (pointers.size === 1) {
      tx += event.clientX - previous.x
      ty += event.clientY - previous.y
    }
    applyTransform()
  }

  const onPointerUp = (event: PointerEvent) => {
    pointers.delete(event.pointerId)
    if (pointers.size < 2) pinchStart = null
  }

  el.addEventListener('click', onClick)
  el.addEventListener('keydown', onKeyDown)
  el.addEventListener('pointerdown', onPointerDown)
  el.addEventListener('pointermove', onPointerMove)
  el.addEventListener('pointerup', onPointerUp)
  el.addEventListener('pointercancel', onPointerUp)

  draw(map)

  return {
    update: draw,
    destroy() {
      el.removeEventListener('click', onClick)
      el.removeEventListener('keydown', onKeyDown)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      el.replaceChildren()
    },
  }
}
