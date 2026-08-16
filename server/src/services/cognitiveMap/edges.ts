import { EDGE_TYPES, type CandidateBeat, type Edge, type EdgeType, type Polarity } from './types'

const MAX_PHRASING = 18

/**
 * The ONLY thing Pass B is given. Deliberately excludes `quote`, so the model cannot
 * see the raw entry: asking one call for both beats and edges reliably produces edges
 * pointing at beats that do not exist, and withholding the source text is what keeps
 * Pass B anchored to the candidate list.
 */
export function formatBeatList(candidates: CandidateBeat[]): string {
  return candidates.map(b => `${b.id} | ${b.kind} | ${b.text}`).join('\n')
}

function toPolarity(value: unknown): Polarity {
  const n = typeof value === 'number' ? value : Number(value)
  if (n === 1) return 1
  if (n === -1) return -1
  return 0
}

/**
 * Tolerant parser for Pass B.
 *
 * An empty result is a valid and common answer: most beats belong to no edge, and
 * link inflation is a worse failure than a sparse map. So unlike Pass A, this never
 * returns null and never signals failure. A map with beats and no edges is still a
 * map.
 *
 * Every edge is validated against the surviving beat ids, because an edge pointing at
 * a missing beat crashes layout.
 */
export function parseEdges(raw: string, validIds: Set<string>): Edge[] {
  let parsed: any
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return []
    parsed = JSON.parse(match[0])
  } catch {
    return []
  }

  const list = Array.isArray(parsed?.edges) ? parsed.edges : []
  const seen = new Set<string>()
  const edges: Edge[] = []

  for (const e of list) {
    const from = (e?.from ?? '').toString().trim()
    const to = (e?.to ?? '').toString().trim()
    const type = (e?.type ?? '').toString().trim()

    if (!validIds.has(from) || !validIds.has(to)) continue
    if (from === to) continue
    if (!EDGE_TYPES.includes(type as EdgeType)) continue

    const key = `${from}->${to}`
    if (seen.has(key)) continue
    seen.add(key)

    const supplied = (e?.phrasing ?? '').toString().trim()
    // Fall back to the canonical type, made readable, so an edge always has a label.
    const phrasing = (supplied || type.replace(/_/g, ' ')).slice(0, MAX_PHRASING)

    edges.push({ from, to, type: type as EdgeType, phrasing, polarity: toPolarity(e?.polarity) })
  }

  return edges
}
