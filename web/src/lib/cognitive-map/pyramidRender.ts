import type { PyramidLayout } from './pyramidLayout'
import { INK_VARS, PYRAMID_VARS } from './theme'

const NS = 'http://www.w3.org/2000/svg'

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
  return node
}

const UNLABELED_OPACITY = '0.55'

/**
 * Pure: a tier's layout to an SVG of tappable dots. One dot per period, sized by
 * childCount, dimmed until its narrative has arrived (per the design spec: "a dot
 * with a position but no periodMaps row yet renders as an unlabeled colored
 * point"), ringed when focused.
 */
export function renderPyramidSvg(
  layout: PyramidLayout,
  focusedPeriodIndex: number | null,
): SVGSVGElement {
  const svg = el('svg', { viewBox: `0 0 ${layout.width} ${layout.height}` })

  for (const p of layout.points) {
    const g = el('g', {
      'data-period-index': String(p.periodIndex),
      role: 'button',
      tabindex: '0',
    })
    g.appendChild(el('circle', {
      cx: String(p.x), cy: String(p.y), r: String(p.r),
      fill: `var(${PYRAMID_VARS.tierDot})`,
      opacity: p.hasNarrative ? '1' : UNLABELED_OPACITY,
    }))
    if (p.periodIndex === focusedPeriodIndex) {
      g.appendChild(el('circle', {
        cx: String(p.x), cy: String(p.y), r: String(p.r + 4),
        fill: 'none',
        stroke: `var(${INK_VARS.keeper})`,
        'stroke-width': '2',
      }))
    }
    svg.appendChild(g)
  }
  return svg
}
