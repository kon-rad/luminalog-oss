import { wrapLabel } from './wrap'
import { breakCycles, assignRanks, orderRanks, edgeKey } from './rank'
import type { BeatKind, CognitiveMap, Domain, Polarity } from './types'

/**
 * All measurements are in ABSTRACT units, not pixels. The mount scales the whole
 * drawing to fit whatever viewport it is given, which is what lets one layout serve a
 * 393pt phone, a rotated phone, and a desktop browser without re-running.
 */
export const GEOMETRY = {
  nodeWidth: 168,
  lineHeight: 19,
  paddingY: 15,
  chipHeight: 16,
  columnGap: 28,
  /** Vertical gap between ranks. Generous, because the edge label sits in it. */
  rankGap: 76,
  margin: 20,
  maxCharsPerLine: 20,
  maxLines: 2,
} as const

export interface LayoutNode {
  id: string
  x: number
  y: number
  w: number
  h: number
  lines: string[]
  kind: BeatKind
  domain: Domain
  isSpine: boolean
  isKeeper: boolean
  chips: string[]
}

export interface LayoutEdge {
  from: string
  to: string
  /** SVG path 'd' attribute, a cubic bezier. */
  path: string
  labelX: number
  labelY: number
  label: string
  polarity: Polarity
  /** True when cycle-breaking flipped this edge; render its arrowhead at `from`. */
  reversed: boolean
}

export interface Layout {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  width: number
  height: number
}

/** Two decimal places, so path strings are stable and compact. */
function round(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Lay out a cognitive map.
 *
 * Pure and deterministic by contract: the same map always produces byte-identical
 * output. That is not an incidental property, it is the reason this is hand-written
 * rather than force-directed. A journal map that reshuffles on every open reads as
 * unreliable, and the product's whole claim is that it shows you your own words
 * faithfully.
 *
 * Ledger-tier beats are excluded here, not upstream, so callers can hand the whole
 * stored map straight in.
 */
export function layout(map: CognitiveMap): Layout {
  const beats = map.beats.filter(b => b.tier === 'map')
  if (beats.length === 0) return { nodes: [], edges: [], width: 0, height: 0 }

  const drawn = new Set(beats.map(b => b.id))
  const beatIds = beats.map(b => b.id)
  const edges = map.edges.filter(e => drawn.has(e.from) && drawn.has(e.to))

  const { acyclic, reversed } = breakCycles(beatIds, edges)
  const ranks = assignRanks(beatIds, acyclic)
  const rows = orderRanks(ranks, acyclic)

  // Measure every node first: height depends on line count and chip presence.
  const byId = new Map(beats.map(b => [b.id, b]))
  const measured = new Map<string, { lines: string[]; h: number; chips: string[] }>()
  for (const beat of beats) {
    const wrapped = wrapLabel(beat.text, GEOMETRY.maxCharsPerLine, GEOMETRY.maxLines)
    const lines = wrapped.length > 0 ? wrapped : [beat.text]
    const chips = beat.mentions.map(m => m.surface)
    const chipSpace = chips.length > 0 ? GEOMETRY.chipHeight + 4 : 0
    measured.set(beat.id, {
      lines,
      chips,
      h: GEOMETRY.paddingY * 2 + lines.length * GEOMETRY.lineHeight + chipSpace,
    })
  }

  // Row widths drive the canvas width; every row is then centred inside it.
  const rowWidths = rows.map(
    row => row.length * GEOMETRY.nodeWidth + Math.max(0, row.length - 1) * GEOMETRY.columnGap,
  )
  const contentWidth = Math.max(...rowWidths, GEOMETRY.nodeWidth)
  const width = contentWidth + GEOMETRY.margin * 2

  const nodes: LayoutNode[] = []
  const placed = new Map<string, LayoutNode>()
  let y = GEOMETRY.margin

  rows.forEach((row, rowIndex) => {
    if (row.length === 0) return
    const rowHeight = Math.max(...row.map(id => measured.get(id)!.h))
    let x = GEOMETRY.margin + (contentWidth - rowWidths[rowIndex]!) / 2

    for (const id of row) {
      const beat = byId.get(id)!
      const m = measured.get(id)!
      const node: LayoutNode = {
        id,
        x: round(x),
        // Centre a short node inside a tall row so a rank reads as one band.
        y: round(y + (rowHeight - m.h) / 2),
        w: GEOMETRY.nodeWidth,
        h: m.h,
        lines: m.lines,
        kind: beat.kind,
        domain: beat.domain,
        isSpine: beat.isSpine,
        isKeeper: beat.isKeeper,
        chips: m.chips,
      }
      nodes.push(node)
      placed.set(id, node)
      x += GEOMETRY.nodeWidth + GEOMETRY.columnGap
    }
    y += rowHeight + GEOMETRY.rankGap
  })

  const height = Math.max(GEOMETRY.margin, y - GEOMETRY.rankGap + GEOMETRY.margin)

  const layoutEdges: LayoutEdge[] = edges.map(edge => {
    const isReversed = reversed.has(edgeKey(edge))
    // Draw along the acyclic direction so the curve always runs downward, then let the
    // renderer flip the arrowhead for a reversed edge.
    const fromId = isReversed ? edge.to : edge.from
    const toId = isReversed ? edge.from : edge.to
    const a = placed.get(fromId)!
    const b = placed.get(toId)!

    const x1 = a.x + a.w / 2
    const y1 = a.y + a.h
    const x2 = b.x + b.w / 2
    const y2 = b.y
    // Control points pulled vertically so the curve leaves and enters squarely, which
    // keeps the arrowhead readable even on a steeply slanted edge.
    const lift = Math.max(18, Math.abs(y2 - y1) / 2)
    const path =
      `M ${round(x1)} ${round(y1)} ` +
      `C ${round(x1)} ${round(y1 + lift)}, ${round(x2)} ${round(y2 - lift)}, ` +
      `${round(x2)} ${round(y2)}`

    return {
      from: edge.from,
      to: edge.to,
      path,
      labelX: round((x1 + x2) / 2),
      labelY: round((y1 + y2) / 2),
      label: edge.phrasing,
      polarity: edge.polarity,
      reversed: isReversed,
    }
  })

  return { nodes, edges: layoutEdges, width: round(width), height: round(height) }
}
