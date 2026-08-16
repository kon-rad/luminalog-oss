import type { Edge } from './types'

export function edgeKey(e: { from: string; to: string }): string {
  return `${e.from}->${e.to}`
}

/**
 * Break every cycle by depth-first search, reversing back-edges rather than dropping
 * them so no information is lost: a reversed edge still renders, with its arrowhead
 * flipped. Self-edges are dropped, since they carry no layout meaning.
 *
 * Determinism matters more here than optimality. Beats are visited in the caller's
 * order, so the same map always breaks the same cycle at the same edge, and a user
 * reopening an entry sees the identical picture.
 */
export function breakCycles(
  beatIds: string[],
  edges: Edge[],
): { acyclic: Edge[]; reversed: Set<string> } {
  const usable = edges.filter(e => e.from !== e.to)
  const out: Record<string, Edge[]> = {}
  for (const id of beatIds) out[id] = []
  for (const e of usable) out[e.from]?.push(e)

  const WHITE = 0, GREY = 1, BLACK = 2
  const color = new Map<string, number>(beatIds.map(id => [id, WHITE]))
  const reversed = new Set<string>()

  const visit = (id: string): void => {
    color.set(id, GREY)
    for (const e of out[id] ?? []) {
      const target = color.get(e.to)
      if (target === GREY) {
        // Back-edge: this closes a cycle. Reverse it.
        reversed.add(edgeKey(e))
      } else if (target === WHITE) {
        visit(e.to)
      }
    }
    color.set(id, BLACK)
  }

  for (const id of beatIds) {
    if (color.get(id) === WHITE) visit(id)
  }

  const acyclic = usable.map(e =>
    reversed.has(edgeKey(e)) ? { ...e, from: e.to, to: e.from } : e,
  )
  return { acyclic, reversed }
}

/**
 * Longest-path ranking. Rank 0 holds every beat with no incoming edge; each other
 * beat sits one rank below its deepest parent, so an edge never points upward and the
 * causal chain reads top to bottom.
 *
 * Longest rather than shortest path: with both `a to b to c` and `a to c` present,
 * shortest-path would put c beside b and draw the a-to-c edge across the rank, which
 * reads as a sibling relationship rather than a consequence.
 */
export function assignRanks(beatIds: string[], acyclic: Edge[]): Map<string, number> {
  const parents = new Map<string, string[]>(beatIds.map(id => [id, []]))
  for (const e of acyclic) parents.get(e.to)?.push(e.from)

  const ranks = new Map<string, number>()
  const visiting = new Set<string>()

  const rankOf = (id: string): number => {
    const cached = ranks.get(id)
    if (cached !== undefined) return cached
    // Guard against any residual cycle: treat a re-entry as a source.
    if (visiting.has(id)) return 0
    visiting.add(id)
    const ps = parents.get(id) ?? []
    const rank = ps.length === 0 ? 0 : Math.max(...ps.map(rankOf)) + 1
    visiting.delete(id)
    ranks.set(id, rank)
    return rank
  }

  for (const id of beatIds) rankOf(id)
  return ranks
}

/**
 * Group beats into rank rows, then reduce edge crossings with barycenter sweeps: each
 * node moves toward the average position of its neighbours in the adjacent rank, four
 * passes down and four back up. Ties keep the previous order, which is what keeps the
 * whole layout deterministic.
 */
export function orderRanks(ranks: Map<string, number>, edges: Edge[]): string[][] {
  // Array.from / forEach rather than iterating the Map directly: this file is
  // compiled by three different toolchains, and the Next build defaults to an ES5
  // target where iterating a Map is a hard compile error.
  const depth = Math.max(0, ...Array.from(ranks.values()))
  const rows: string[][] = Array.from({ length: depth + 1 }, () => [])
  ranks.forEach((rank, id) => { rows[rank]?.push(id) })

  const neighboursAbove = new Map<string, string[]>()
  const neighboursBelow = new Map<string, string[]>()
  for (const e of edges) {
    if (ranks.get(e.from) === undefined || ranks.get(e.to) === undefined) continue
    if (!neighboursAbove.has(e.to)) neighboursAbove.set(e.to, [])
    neighboursAbove.get(e.to)!.push(e.from)
    if (!neighboursBelow.has(e.from)) neighboursBelow.set(e.from, [])
    neighboursBelow.get(e.from)!.push(e.to)
  }

  const sweep = (row: string[], fixed: string[], links: Map<string, string[]>): string[] => {
    const index = new Map(fixed.map((id, i) => [id, i]))
    const positions = new Map(row.map((id, i) => [id, i]))
    const barycentre = (id: string): number => {
      const ns = (links.get(id) ?? [])
        .map(n => index.get(n))
        .filter((n): n is number => n !== undefined)
      return ns.length === 0 ? positions.get(id)! : ns.reduce((a, b) => a + b, 0) / ns.length
    }
    return [...row].sort((a, b) => {
      const delta = barycentre(a) - barycentre(b)
      return delta !== 0 ? delta : positions.get(a)! - positions.get(b)!
    })
  }

  for (let pass = 0; pass < 4; pass++) {
    for (let r = 1; r < rows.length; r++) {
      rows[r] = sweep(rows[r]!, rows[r - 1]!, neighboursAbove)
    }
    for (let r = rows.length - 2; r >= 0; r--) {
      rows[r] = sweep(rows[r]!, rows[r + 1]!, neighboursBelow)
    }
  }

  return rows
}
