import { GEOMETRY, type Layout, type LayoutEdge, type LayoutNode } from './layout'
import { DOMAIN_VARS, INK_VARS, DEFAULT_LIGHT, DEFAULT_DARK } from './theme'

export { DOMAIN_VARS, INK_VARS, DEFAULT_LIGHT, DEFAULT_DARK }

const NS = 'http://www.w3.org/2000/svg'
/** U+2212 MINUS SIGN. A hyphen reads as a dash beside the "+" and is easy to miss. */
const MINUS = '−'

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
  return node
}

/**
 * Shape binds to KIND and nothing else, exactly as colour binds to DOMAIN and nothing
 * else. Four shapes is a deliberate ceiling: a fifth would mean memorizing a legend,
 * and this has to be readable in about four seconds.
 */
export function nodeShapePath(
  node: Pick<LayoutNode, 'kind' | 'w' | 'h'>,
): { tag: 'rect' | 'ellipse'; attrs: Record<string, string> } {
  switch (node.kind) {
    case 'feeling':
      return {
        tag: 'ellipse',
        attrs: {
          cx: String(node.w / 2), cy: String(node.h / 2),
          rx: String(node.w / 2), ry: String(node.h / 2),
        },
      }
    case 'belief':
      return {
        tag: 'rect',
        attrs: {
          width: String(node.w), height: String(node.h),
          rx: String(node.h / 2), ry: String(node.h / 2),
        },
      }
    case 'intent':
      return {
        tag: 'rect',
        attrs: {
          width: String(node.w), height: String(node.h),
          rx: '4', ry: '4', 'stroke-dasharray': '6 4',
        },
      }
    case 'event':
    default:
      return {
        tag: 'rect',
        attrs: { width: String(node.w), height: String(node.h), rx: '4', ry: '4' },
      }
  }
}

function renderNode(node: LayoutNode): SVGGElement {
  const group = el('g', {
    'data-beat-id': node.id,
    'data-spine': String(node.isSpine),
    'data-keeper': String(node.isKeeper),
    transform: `translate(${node.x} ${node.y})`,
    role: 'button',
    tabindex: '0',
    'aria-label': `${node.kind}: ${node.lines.join(' ')}`,
  })

  const color = `var(${DOMAIN_VARS[node.domain]})`
  const shape = nodeShapePath(node)
  const body = el(shape.tag, {
    ...shape.attrs,
    fill: color,
    // A spine beat carries the day; the rest sit back. Opacity, not a second hue,
    // because hue is already spoken for by domain.
    'fill-opacity': node.isSpine ? '0.16' : '0.09',
    stroke: color,
    'stroke-width': node.isSpine ? '1.75' : '1',
  })
  group.appendChild(body)

  if (node.isKeeper) {
    // Inset so the gold reads as a hairline INSIDE the domain stroke rather than
    // competing with it.
    const inset = 3
    const halo = el(shape.tag, {
      ...nodeShapePath({ kind: node.kind, w: node.w - inset * 2, h: node.h - inset * 2 }).attrs,
      transform: `translate(${inset} ${inset})`,
      fill: 'none',
      stroke: `var(${INK_VARS.keeper})`,
      'stroke-width': '1',
    })
    group.appendChild(halo)
  }

  const hasChips = node.chips.length > 0
  const textBlockHeight = node.lines.length * GEOMETRY.lineHeight
  const chipSpace = hasChips ? GEOMETRY.chipHeight + 4 : 0
  const firstBaseline = (node.h - chipSpace - textBlockHeight) / 2 + GEOMETRY.lineHeight * 0.75

  node.lines.forEach((line, index) => {
    const text = el('text', {
      class: 'cm-label',
      x: String(node.w / 2),
      y: String(firstBaseline + index * GEOMETRY.lineHeight),
      'text-anchor': 'middle',
      fill: `var(${INK_VARS.text})`,
      'font-size': node.isSpine ? '13' : '12',
      'font-weight': node.isSpine ? '600' : '400',
    })
    text.textContent = line
    group.appendChild(text)
  })

  if (hasChips) {
    const chipText = el('text', {
      class: 'cm-chip',
      x: String(node.w / 2),
      y: String(node.h - GEOMETRY.paddingY / 2),
      'text-anchor': 'middle',
      fill: `var(${INK_VARS.textMuted})`,
      'font-size': '10',
    })
    chipText.textContent = node.chips.join(' · ')
    group.appendChild(chipText)
  }

  return group
}

function renderEdge(edge: LayoutEdge): SVGGElement {
  const group = el('g', { 'data-edge': `${edge.from}->${edge.to}` })

  group.appendChild(el('path', {
    class: 'cm-edge',
    d: edge.path,
    fill: 'none',
    stroke: `var(${INK_VARS.edge})`,
    'stroke-width': '1.25',
    'stroke-opacity': '0.55',
    'marker-end': edge.reversed ? 'url(#cm-arrow-start)' : 'url(#cm-arrow)',
  }))

  // A plate behind the label so the curve does not run through the words. The label
  // sits exactly on the bezier midpoint, so without this the stroke bisects the text.
  const plateWidth = Math.max(edge.label.length * 6.2 + 12, 24)
  group.appendChild(el('rect', {
    class: 'cm-edge-plate',
    x: String(edge.labelX - plateWidth / 2),
    y: String(edge.labelY - 9),
    width: String(plateWidth),
    height: '18',
    rx: '4',
    fill: `var(${INK_VARS.surface})`,
  }))

  const label = el('text', {
    class: 'cm-edge-label',
    x: String(edge.labelX),
    y: String(edge.labelY + 4),
    'text-anchor': 'middle',
    fill: `var(${INK_VARS.textMuted})`,
    'font-size': '10.5',
  })
  label.textContent = edge.label
  group.appendChild(label)

  if (edge.polarity !== 0) {
    const sign = el('text', {
      class: 'cm-edge-polarity',
      x: String(edge.labelX + plateWidth / 2 + 5),
      y: String(edge.labelY + 4),
      'text-anchor': 'middle',
      fill: `var(${INK_VARS.textMuted})`,
      'font-size': '10.5',
    })
    sign.textContent = edge.polarity === 1 ? '+' : MINUS
    group.appendChild(sign)
  }

  return group
}

function arrowDefs(): SVGDefsElement {
  const defs = el('defs')
  for (const [id, path, refX] of [
    ['cm-arrow', 'M 0 0 L 7 3.5 L 0 7 z', '7'],
    ['cm-arrow-start', 'M 7 0 L 0 3.5 L 7 7 z', '0'],
  ] as const) {
    const marker = el('marker', {
      id,
      viewBox: '0 0 7 7',
      refX,
      refY: '3.5',
      markerWidth: '5.5',
      markerHeight: '5.5',
      orient: 'auto-start-reverse',
    })
    marker.appendChild(el('path', {
      d: path, fill: `var(${INK_VARS.edge})`, 'fill-opacity': '0.55',
    }))
    defs.appendChild(marker)
  }
  return defs
}

/** Build the whole drawing. Edges render first so nodes sit on top of them. */
export function renderSvg(layoutResult: Layout): SVGSVGElement {
  const svg = el('svg', {
    xmlns: NS,
    viewBox: `0 0 ${layoutResult.width} ${layoutResult.height}`,
    role: 'img',
    'aria-label': `Cognitive map with ${layoutResult.nodes.length} beats`,
  })
  svg.appendChild(arrowDefs())

  const edgeLayer = el('g', { class: 'cm-edges' })
  for (const edge of layoutResult.edges) edgeLayer.appendChild(renderEdge(edge))
  svg.appendChild(edgeLayer)

  const nodeLayer = el('g', { class: 'cm-nodes' })
  for (const node of layoutResult.nodes) nodeLayer.appendChild(renderNode(node))
  svg.appendChild(nodeLayer)

  return svg
}
